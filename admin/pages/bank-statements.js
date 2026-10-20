import { formatCurrency } from '../../data/helpers/currency.js';
import { formatDate } from '../../data/helpers/date.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function toISODate(value) {
  const input = String(value || '').trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (isoMatch) {
    const date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return date.getFullYear() === Number(isoMatch[1])
      && date.getMonth() === Number(isoMatch[2]) - 1
      && date.getDate() === Number(isoMatch[3]) ? input : null;
  }
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  if (date.getFullYear() !== Number(match[3]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[1])) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      cell = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else cell += character;
  }
  row.push(cell.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  return rows;
}

function renderRows(container, context) {
  const filter = container.querySelector('#statementStatusFilter').value;
  const tenants = new Map(context.data.tenants.map((tenant) => [tenant.id, tenant]));
  const rows = [...context.data.bankStatements]
    .filter((line) => !filter || line.status === filter)
    .sort((a, b) => b.date.localeCompare(a.date));
  container.querySelector('#statementCount').textContent = `${rows.length} statement lines`;
  container.querySelector('#statementRows').innerHTML = rows.length
    ? rows.map((line) => {
      const suggestedTenant = tenants.get(line.suggestedTenantId);
      const isReviewable = line.direction === 'in' && line.status !== 'matched';
      const confidence = Number.isFinite(Number(line.suggestedConfidence)) ? `${Math.round(Number(line.suggestedConfidence) * 100)}%` : '—';
      const status = line.status === 'needs review' ? 'Needs review' : line.status[0].toUpperCase() + line.status.slice(1);
      const tone = line.status === 'matched' ? 'success' : line.status === 'needs review' ? 'warning' : 'secondary';
      return `<tr>
        <td>${formatDate(line.date)}</td><td><strong>${escapeHtml(line.description)}</strong>${suggestedTenant ? `<div class="small text-secondary">Suggested: ${escapeHtml(suggestedTenant.name)}</div>` : ''}</td>
        <td>${line.direction === 'in' ? '<span class="text-success">Money in</span>' : '<span class="text-secondary">Money out</span>'}</td>
        <td class="text-end">${formatCurrency(line.amount, context.data.config)}</td><td>${suggestedTenant ? `${escapeHtml(suggestedTenant.name)} · ${confidence}` : 'No match suggested'}</td>
        <td><span class="badge text-bg-${tone} bg-opacity-10 text-${tone} border border-${tone} border-opacity-10">${escapeHtml(status)}</span></td>
        <td class="text-end text-nowrap">${context.role !== 'accountant' && isReviewable ? `<button class="btn btn-sm btn-success" data-action="accept-match" data-id="${escapeHtml(line.id)}" ${!line.suggestedTenantId ? 'disabled' : ''}>Accept</button> <button class="btn btn-sm btn-light" data-action="change-match" data-id="${escapeHtml(line.id)}">Change</button> <button class="btn btn-sm btn-outline-secondary" data-action="reject-match" data-id="${escapeHtml(line.id)}">Reject</button>` : ''}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="7"><div class="empty-state"><i class="bi bi-bank"></i>No statement lines match this filter.</div></td></tr>';
}

function matchModal(line, context, accept) {
  const tenants = context.data.tenants.filter((tenant) => tenant.status === 'active');
  const selectedTenant = line.suggestedTenantId || '';
  const schedules = context.data.rentSchedule.filter((schedule) =>
    schedule.tenantId === selectedTenant && schedule.dueDate.slice(0, 7) === line.date.slice(0, 7)
  );
  const defaultSchedule = schedules.find((schedule) => Number(schedule.amount) - Number(schedule.paidAmount || 0) >= Number(line.amount)) || schedules[0];
  return `<div class="modal fade" id="bankMatchModal" tabindex="-1" aria-labelledby="bankMatchTitle" aria-hidden="true"><div class="modal-dialog"><form class="modal-content" id="bankMatchForm" data-line-id="${escapeHtml(line.id)}" data-accept="${accept}">
    <div class="modal-header"><div><h2 class="modal-title fs-5" id="bankMatchTitle">${accept ? 'Review and accept payment match' : 'Change suggested match'}</h2><p class="small text-secondary mb-0">${escapeHtml(line.description)} · ${formatCurrency(line.amount, context.data.config)} · ${formatDate(line.date)}</p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
    <div class="modal-body"><div class="alert alert-warning small">${accept ? 'Accepting this match records the payment, updates the rent schedule and posts the ledger entries.' : 'Changing a suggestion does not record a payment. Accept it separately after review.'} No payment is recorded before confirmation.</div>
      <div class="mb-3"><label class="form-label" for="matchTenant">Tenant</label><select class="form-select" id="matchTenant" name="tenantId" required><option value="">Choose tenant</option>${tenants.map((tenant) => `<option value="${escapeHtml(tenant.id)}" ${tenant.id === selectedTenant ? 'selected' : ''}>${escapeHtml(tenant.name)} · ${escapeHtml(context.data.properties.find((property) => property.id === tenant.propertyId)?.name || '')}</option>`).join('')}</select></div>
      <div><label class="form-label" for="matchSchedule">Rent schedule item${accept ? '' : ' (optional)'}</label><select class="form-select" id="matchSchedule" name="rentScheduleId" ${accept ? 'required' : ''}><option value="">Choose rent period</option>${schedules.map((schedule) => `<option value="${escapeHtml(schedule.id)}" ${schedule.id === defaultSchedule?.id ? 'selected' : ''}>${formatDate(schedule.dueDate)} · due ${formatCurrency(schedule.amount, context.data.config)} · remaining ${formatCurrency(Math.max(0, schedule.amount - Number(schedule.paidAmount || 0)), context.data.config)}</option>`).join('')}</select><div class="form-text" id="matchScheduleHelp">${accept && !schedules.length ? 'No schedule exists for this tenant and statement month; create or select the correct rent period before accepting.' : 'Only schedule entries for the selected tenant and statement month are shown.'}</div></div>
      ${accept ? '<div class="form-check mt-3"><input class="form-check-input" type="checkbox" id="confirmBankMatch" required><label class="form-check-label small" for="confirmBankMatch">I have reviewed this suggested match and confirm recording the payment.</label></div>' : ''}
    </div><div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-forest">${accept ? 'Confirm match and record payment' : 'Save suggestion'}</button></div>
  </form></div></div>`;
}

export function renderBankStatements(container, context) {
  const canEdit = context.role !== 'accountant';
  const matched = context.data.bankStatements.filter((line) => line.status === 'matched').length;
  const review = context.data.bankStatements.filter((line) => line.status === 'needs review').length;
  const unmatched = context.data.bankStatements.filter((line) => line.status === 'unmatched').length;
  container.innerHTML = `<div class="page-header"><div><p class="page-eyebrow">Finance</p><h1 class="page-title">Bank Statements</h1><p class="page-subtitle">Review imported statement lines and confirm rent matches before payments are posted.</p></div><div class="d-flex gap-2">${canEdit ? '<button class="btn btn-light border" data-action="ai-match"><i class="bi bi-stars me-1"></i>Suggest matches</button><button class="btn btn-forest" data-action="import-csv"><i class="bi bi-upload me-1"></i>Import CSV</button><input class="visually-hidden" type="file" id="statementCsvInput" accept=".csv,text/csv">' : '<span class="small text-secondary">Read-only access</span>'}</div></div>
    <div class="row g-3 mb-3"><div class="col-4"><div class="stat-card"><div class="stat-label">Matched</div><div class="stat-value text-success">${matched}</div></div></div><div class="col-4"><div class="stat-card"><div class="stat-label">Needs review</div><div class="stat-value text-warning">${review}</div></div></div><div class="col-4"><div class="stat-card"><div class="stat-label">Unmatched</div><div class="stat-value">${unmatched}</div></div></div></div>
    <section class="panel-card mb-3"><div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3"><div><h2 class="h6 fw-bold mb-1">Statement lines</h2><p class="small text-secondary mb-0">AI only suggests a tenant. Review and explicitly accept a match before any payment is recorded.</p></div><div class="d-flex align-items-center gap-2"><span id="statementCount" class="small text-secondary"></span><span id="bankAiBadge"></span></div></div>
      <div class="row g-2 mb-3"><div class="col-sm-5 col-lg-3"><label class="visually-hidden" for="statementStatusFilter">Filter statement status</label><select class="form-select form-select-sm" id="statementStatusFilter"><option value="">All statuses</option><option value="needs review">Needs review</option><option value="unmatched">Unmatched</option><option value="matched">Matched</option></select></div><div class="col-12"><p class="form-text mb-0">CSV columns: Date (YYYY-MM-DD or DD/MM/YYYY), Description, Amount and Direction (in/out). Imports start unmatched; no rent is changed until you accept a reviewed match.</p></div></div>
      <div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Date</th><th>Description / suggestion</th><th>Direction</th><th class="text-end">Amount</th><th>AI suggestion</th><th>Status</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody id="statementRows"></tbody></table></div>
    </section>
    <section class="panel-card"><div class="d-flex flex-wrap justify-content-between gap-2 align-items-start"><div><h2 class="h6 fw-bold mb-1"><i class="bi bi-bank me-2"></i>ANNA / Open Banking connection</h2><p class="small text-secondary mb-0">Connect a supported business bank feed to import transactions automatically.</p></div><span class="badge text-bg-secondary bg-opacity-10 text-secondary">Not connected</span></div><div class="mt-3" id="bankFeedBadge"></div></section><div id="bankModalHost"></div>`;
  if (canEdit) container.querySelector('#bankAiBadge').replaceWith(context.createNeedsLiveBadge('ai', 'AI matching is simulated'));
  container.querySelector('#bankFeedBadge').replaceWith(context.createNeedsLiveBadge('banking', 'Connect Open Banking'));
  const update = () => renderRows(container, context);
  container.querySelector('#statementStatusFilter').addEventListener('change', update);
  update();
  if (!canEdit) return;
  container.onclick = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'import-csv') container.querySelector('#statementCsvInput').click();
    if (button.dataset.action === 'ai-match') suggestMatches(context);
    const line = context.data.bankStatements.find((item) => item.id === button.dataset.id);
    if (line && ['accept-match', 'change-match'].includes(button.dataset.action)) {
      openMatchModal(container, context, line, button.dataset.action === 'accept-match');
    }
    if (line && button.dataset.action === 'reject-match') rejectSuggestion(line, context);
  };
  container.querySelector('#statementCsvInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importStatementCsv(file, context);
      context.refresh();
    } catch (error) {
      context.toast(`Could not import CSV: ${error.message}`, 'error');
    } finally {
      event.target.value = '';
    }
  });
}

function openMatchModal(container, context, line, accepting) {
  const host = container.querySelector('#bankModalHost');
  host.innerHTML = matchModal(line, context, accepting);
  const modalElement = host.querySelector('#bankMatchModal');
  const form = host.querySelector('#bankMatchForm');
  const tenantSelect = form.elements.namedItem('tenantId');
  const scheduleSelect = form.elements.namedItem('rentScheduleId');
  tenantSelect.addEventListener('change', () => {
    const chosen = tenantSelect.value;
    const schedules = context.data.rentSchedule.filter((schedule) =>
      schedule.tenantId === chosen && schedule.dueDate.slice(0, 7) === line.date.slice(0, 7)
    );
    scheduleSelect.innerHTML = `<option value="">Choose rent period</option>${schedules.map((schedule) => `<option value="${escapeHtml(schedule.id)}">${formatDate(schedule.dueDate)} · due ${formatCurrency(schedule.amount, context.data.config)} · remaining ${formatCurrency(Math.max(0, schedule.amount - Number(schedule.paidAmount || 0)), context.data.config)}</option>`).join('')}`;
    form.querySelector('#matchScheduleHelp').textContent = schedules.length ? 'Only schedule entries for the selected tenant and statement month are shown.' : 'No schedule exists for this tenant and statement month.';
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const tenantId = tenantSelect.value;
    const scheduleId = scheduleSelect.value;
    if (accepting) {
      if (!form.querySelector('#confirmBankMatch').checked) {
        context.toast('Confirm that you reviewed the bank match.', 'error');
        return;
      }
      const schedule = context.data.rentSchedule.find((item) => item.id === scheduleId);
      if (!schedule || schedule.tenantId !== tenantId || schedule.dueDate.slice(0, 7) !== line.date.slice(0, 7)) {
        context.toast('Choose a valid rent schedule for this tenant and statement month.', 'error');
        return;
      }
      const balance = schedule.amount - Number(schedule.paidAmount || 0);
      if (Number(line.amount) <= 0 || Number(line.amount) > balance) {
        context.toast('Statement amount must be positive and no greater than the selected rent balance.', 'error');
        return;
      }
      acceptMatch(line, schedule, tenantId, context, modalElement);
    } else {
      line.suggestedTenantId = tenantId;
      line.suggestedConfidence = null;
      line.status = 'needs review';
      try {
        // This store write becomes the bank-statement matching API call when a backend is introduced.
        context.save('bankStatements', context.data.bankStatements);
        context.save('auditLog', [...context.data.auditLog, createAudit(context, 'Changed match suggestion', `Updated suggested tenant for ${line.id} to ${context.data.tenants.find((tenant) => tenant.id === tenantId)?.name || 'tenant'}.`)]);
        window.bootstrap.Modal.getInstance(modalElement)?.hide();
        context.refresh();
        context.toast('Match suggestion updated; payment not recorded');
      } catch (error) {
        context.toast(`Could not update suggestion: ${error.message}`, 'error');
      }
    }
  });
  window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

function createAudit(context, action, detail) {
  return {
    id: makeId('audit'),
    date: `${context.data.config.demoToday}T12:00:00`,
    userName: context.role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
    action,
    entity: 'Bank statement',
    detail
  };
}

function acceptMatch(line, schedule, tenantId, context, modalElement) {
  const tenant = context.data.tenants.find((item) => item.id === tenantId);
  const property = context.data.properties.find((item) => item.id === schedule.propertyId);
  const payment = {
    id: makeId('pay'),
    tenantId,
    propertyId: schedule.propertyId,
    amount: Number(line.amount),
    date: line.date,
    method: 'bank transfer',
    reference: line.description.slice(0, 50),
    rentScheduleId: schedule.id,
    source: 'bank statement',
    matchStatus: 'matched'
  };
  schedule.paidAmount = Number(schedule.paidAmount || 0) + payment.amount;
  schedule.status = schedule.paidAmount >= schedule.amount ? 'paid' : 'partial';
  schedule.paidOn = schedule.status === 'paid' ? line.date : null;
  schedule.method = 'bank transfer';
  line.status = 'matched';
  line.matchedTenantId = tenantId;
  line.matchedRentScheduleId = schedule.id;
  line.suggestedTenantId = tenantId;
  line.suggestedConfidence = null;
  const ledger = [
    { id: makeId('led'), date: line.date, accountId: 'acc-bank', propertyId: schedule.propertyId, description: `Bank rent received - ${tenant?.name || 'tenant'}`, debit: payment.amount, credit: 0, linkedPaymentId: payment.id, linkedBillId: null },
    { id: makeId('led'), date: line.date, accountId: 'acc-rent', propertyId: schedule.propertyId, description: `Rent income - ${tenant?.name || 'tenant'}`, debit: 0, credit: payment.amount, linkedPaymentId: payment.id, linkedBillId: null }
  ];
  context.data.payments.push(payment);
  context.data.ledger.push(...ledger);
  context.data.notifications.push({
    id: makeId('notification'),
    userId: tenant?.userId || tenantId,
    audience: 'tenant',
    title: 'Rent payment matched',
    body: `${formatCurrency(payment.amount, context.data.config)} received on ${formatDate(line.date)} has been matched to your rent.`,
    type: 'rent',
    createdOn: context.data.config.demoToday,
    read: false
  });
  context.data.notifications.push({
    id: makeId('notification'),
    userId: context.role === 'superadmin' ? 'u-admin' : 'u-manager',
    audience: 'admin',
    title: 'Bank payment matched',
    body: `${formatCurrency(payment.amount, context.data.config)} matched to ${tenant?.name || 'tenant'} at ${property?.name || 'property'}.`,
    type: 'rent',
    createdOn: context.data.config.demoToday,
    read: false
  });
  try {
    // These writes become the bank matching, rent, payments, ledger and notification API calls when a backend is introduced.
    context.save('bankStatements', context.data.bankStatements);
    context.save('rentSchedule', context.data.rentSchedule);
    context.save('payments', context.data.payments);
    context.save('ledger', context.data.ledger);
    context.save('notifications', context.data.notifications);
    context.save('auditLog', [...context.data.auditLog, createAudit(context, 'Accepted match', `${formatCurrency(payment.amount, context.data.config)} from ${tenant?.name || 'tenant'} matched to ${schedule.id}.`)]);
    window.bootstrap.Modal.getInstance(modalElement)?.hide();
    context.toast('Bank match accepted and payment recorded');
  } catch (error) {
    context.toast(`Could not accept bank match: ${error.message}`, 'error');
    return;
  }
  context.refresh();
}

function rejectSuggestion(line, context) {
  line.status = 'unmatched';
  line.suggestedTenantId = null;
  line.suggestedConfidence = null;
  try {
    // These store writes become the bank-matching and audit API calls when a backend is introduced.
    context.save('bankStatements', context.data.bankStatements);
    context.save('auditLog', [...context.data.auditLog, createAudit(context, 'Rejected match suggestion', `Rejected suggested tenant for ${line.id}; no payment was recorded.`)]);
    context.refresh();
    context.toast('Match suggestion rejected; no payment was recorded', 'info');
  } catch (error) {
    context.toast(`Could not reject suggestion: ${error.message}`, 'error');
  }
}

function suggestMatches(context) {
  let suggested = 0;
  for (const line of context.data.bankStatements) {
    if (line.direction !== 'in' || line.status !== 'unmatched') continue;
    const normalized = line.description.toLowerCase();
    const namedTenant = context.data.tenants.find((item) =>
      normalized.includes(item.name.toLowerCase()) || item.name.split(' ').some((part) => part.length > 3 && normalized.includes(part.toLowerCase()))
    );
    const suggestedSchedule = context.data.rentSchedule
      .filter((schedule) => schedule.dueDate.slice(0, 7) === line.date.slice(0, 7)
        && Number(schedule.amount) - Number(schedule.paidAmount || 0) >= Number(line.amount))
      .sort((a, b) => Math.abs(a.amount - line.amount) - Math.abs(b.amount - line.amount))[0];
    const tenant = namedTenant || (suggestedSchedule && context.data.tenants.find((item) => item.id === suggestedSchedule.tenantId));
    if (!tenant) continue;
    line.suggestedTenantId = tenant.id;
    line.suggestedConfidence = namedTenant ? 0.82 : Math.max(0.55, 0.72 - Math.abs(suggestedSchedule.amount - line.amount) / suggestedSchedule.amount);
    line.status = 'needs review';
    suggested += 1;
  }
  if (!suggested) {
    context.toast('No new likely tenant matches found in unmatched incoming lines.', 'info');
    return;
  }
  try {
    // These store writes become the AI match suggestion and audit API calls when a backend is introduced.
    context.save('bankStatements', context.data.bankStatements);
    context.save('auditLog', [...context.data.auditLog, createAudit(context, 'Generated match suggestions', `${suggested} possible incoming bank match(es) suggested for human review.`)]);
    context.refresh();
    context.toast(`${suggested} possible match${suggested === 1 ? '' : 'es'} suggested; review before accepting`);
  } catch (error) {
    context.toast(`Could not save match suggestions: ${error.message}`, 'error');
  }
}

async function importStatementCsv(file, context) {
  const parsed = parseCsv(await file.text());
  if (parsed.length < 2) throw new Error('CSV must include a header and at least one transaction row.');
  const headers = parsed[0].map((header) => header.toLowerCase().replace(/[^a-z]/g, ''));
  const indexOf = (...aliases) => headers.findIndex((header) => aliases.includes(header));
  const dateIndex = indexOf('date', 'transactiondate');
  const descriptionIndex = indexOf('description', 'details', 'reference', 'narrative');
  const amountIndex = indexOf('amount', 'value');
  const directionIndex = indexOf('direction', 'type');
  if ([dateIndex, descriptionIndex, amountIndex, directionIndex].some((index) => index < 0)) {
    throw new Error('Required CSV columns are Date, Description, Amount and Direction.');
  }
  const imported = [];
  const errors = [];
  for (let rowIndex = 1; rowIndex < parsed.length; rowIndex += 1) {
    const row = parsed[rowIndex];
    const date = toISODate(row[dateIndex]);
    const description = row[descriptionIndex]?.trim();
    const amount = Number(String(row[amountIndex] || '').replace(/[£,\s]/g, ''));
    const directionRaw = row[directionIndex]?.trim().toLowerCase();
    const direction = ['in', 'credit', 'income'].includes(directionRaw) ? 'in' : ['out', 'debit', 'expense'].includes(directionRaw) ? 'out' : null;
    if (!date || date > context.data.config.demoToday || !description || !Number.isFinite(amount) || amount <= 0 || !direction) {
      errors.push(`row ${rowIndex + 1}`);
      continue;
    }
    if (context.data.bankStatements.some((line) => line.date === date && line.description === description && Number(line.amount) === amount)) continue;
    imported.push({
      id: makeId('bank'),
      date,
      description,
      amount,
      direction,
      suggestedTenantId: null,
      suggestedConfidence: null,
      status: 'unmatched'
    });
  }
  if (!imported.length) throw new Error(errors.length ? `No valid rows imported (${errors.join(', ')}).` : 'No new transaction rows found.');
  context.data.bankStatements.push(...imported);
  try {
    // These store writes become the bank import and audit API calls when a backend is introduced.
    context.save('bankStatements', context.data.bankStatements);
    context.save('auditLog', [...context.data.auditLog, createAudit(context, 'Imported CSV', `${imported.length} statement line(s) imported from ${file.name}${errors.length ? `; invalid rows skipped: ${errors.join(', ')}` : ''}.`)]);
  } catch (error) {
    throw new Error(`Store rejected imported statement data: ${error.message}`);
  }
  context.toast(`${imported.length} statement line${imported.length === 1 ? '' : 's'} imported${errors.length ? `; skipped ${errors.length} invalid row(s)` : ''}`);
}
