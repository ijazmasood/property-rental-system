import { formatCurrency } from '../../data/helpers/currency.js';
import { daysBetween, formatDate } from '../../data/helpers/date.js';
import { getBillStatus } from '../../data/helpers/status.js';

const BILL_TYPES = ['Gas', 'Electric', 'Water', 'Council Tax', 'Internet'];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function audit(context, action, detail) {
  return {
    id: makeId('audit'),
    date: `${context.data.config.demoToday}T12:00:00`,
    userName: context.role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
    action,
    entity: 'Bill',
    detail
  };
}

function expenseAccountForBill(type) {
  return type === 'Council Tax' ? 'acc-council-tax' : 'acc-utilities';
}

function statusFor(bill, config) {
  if (bill.status === 'paid') return 'paid';
  return getBillStatus(bill, config) === 'overdue' ? 'overdue' : 'unpaid';
}

function getRows(data) {
  const properties = new Map(data.properties.map((property) => [property.id, property]));
  return data.bills.map((bill) => ({
    ...bill,
    property: properties.get(bill.propertyId),
    computedStatus: statusFor(bill, data.config),
    daysToDue: daysBetween(data.config.demoToday, bill.dueDate)
  }));
}

function statusBadge(status) {
  const tone = { paid: 'success', unpaid: 'warning', overdue: 'danger' }[status] || 'secondary';
  return `<span class="badge text-bg-${tone} bg-opacity-10 text-${tone} border border-${tone} border-opacity-10">${status[0].toUpperCase()}${escapeHtml(status.slice(1))}</span>`;
}

function billModal(data, bill = null, scanMode = false) {
  const startDate = bill?.dueDate || data.config.demoToday;
  return `<div class="modal fade" id="billModal" tabindex="-1" aria-labelledby="billModalTitle" aria-hidden="true"><div class="modal-dialog modal-lg modal-dialog-scrollable">
    <form class="modal-content" id="billForm" data-scan-mode="${scanMode}">
      <div class="modal-header"><div><h2 class="modal-title fs-5" id="billModalTitle">${scanMode ? 'AI Scan bill' : bill ? 'Edit bill' : 'Add bill'}</h2><p class="small text-secondary mb-0">${scanMode ? 'Simulated extraction is a suggestion; review and confirm before saving.' : 'Bill records store metadata and an optional file name only.'}</p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
      <div class="modal-body"><div class="row g-3">
        <div class="col-md-6"><label class="form-label" for="billProperty">Property</label><select class="form-select" id="billProperty" name="propertyId" required><option value="">Choose property</option>${data.properties.map((property) => `<option value="${escapeHtml(property.id)}" ${property.id === bill?.propertyId ? 'selected' : ''}>${escapeHtml(property.name)} · ${escapeHtml(property.postcode)}</option>`).join('')}</select></div>
        <div class="col-md-6"><label class="form-label" for="billType">Bill type</label><select class="form-select" id="billType" name="type" required>${BILL_TYPES.map((type) => `<option ${type === bill?.type ? 'selected' : ''}>${type}</option>`).join('')}</select></div>
        <div class="col-md-6"><label class="form-label" for="billSupplier">Supplier</label><input class="form-control" id="billSupplier" name="supplier" value="${escapeHtml(bill?.supplier || '')}" maxlength="100" required></div>
        <div class="col-md-6"><label class="form-label" for="billAmount">Amount (£)</label><input class="form-control" id="billAmount" name="amount" type="number" min="0.01" step="0.01" value="${escapeHtml(bill?.amount ?? '')}" required></div>
        <div class="col-md-6"><label class="form-label" for="billDueDate">Due date</label><input class="form-control" id="billDueDate" name="dueDate" type="date" required value="${escapeHtml(startDate)}"></div>
        <div class="col-md-6"><label class="form-label" for="billPaidBy">Paid by</label><select class="form-select" id="billPaidBy" name="paidBy"><option value="landlord" ${!bill || bill.paidBy === 'landlord' ? 'selected' : ''}>Landlord</option><option value="tenant" ${bill?.paidBy === 'tenant' ? 'selected' : ''}>Tenant</option></select></div>
        <div class="col-md-6"><label class="form-label" for="billAccountRef">Account reference</label><input class="form-control" id="billAccountRef" name="accountRef" maxlength="80" value="${escapeHtml(bill?.accountRef || '')}"></div>
        <div class="col-md-6"><label class="form-label" for="billAttachment">Attachment file name</label><input class="form-control" id="billAttachment" name="attachment" maxlength="160" placeholder="invoice.pdf" value="${escapeHtml(bill?.attachment || '')}"></div>
      </div>
      ${scanMode ? `<div class="mt-3"><button type="button" class="btn btn-outline-secondary btn-sm" id="simulateBillScan"><i class="bi bi-stars me-1"></i>Simulate AI scan</button> <span id="billScanBadge"></span></div><div class="alert alert-info mt-3 d-none" id="billScanReview"><strong>Review extracted details</strong><p class="small mb-2" id="billScanConfidence"></p><div class="form-check"><input class="form-check-input" id="billScanConfirm" type="checkbox" required><label class="form-check-label small" for="billScanConfirm">I reviewed and confirm these bill details.</label></div></div>` : ''}
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-forest" id="saveBillButton" ${scanMode ? 'disabled' : ''}>${scanMode ? 'Confirm and save bill' : bill ? 'Save changes' : 'Save bill'}</button></div>
    </form></div></div>`;
}

function renderTable(container, context) {
  const query = container.querySelector('#billSearch').value.trim().toLowerCase();
  const propertyId = container.querySelector('#billPropertyFilter').value;
  const status = container.querySelector('#billStatusFilter').value;
  const rows = getRows(context.data).filter((bill) =>
    (!propertyId || bill.propertyId === propertyId)
    && (!status || bill.computedStatus === status)
    && `${bill.supplier} ${bill.type} ${bill.accountRef || ''} ${bill.property?.name || ''}`.toLowerCase().includes(query)
  ).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  container.querySelector('#billCount').textContent = `${rows.length} ${rows.length === 1 ? 'bill' : 'bills'}`;
  container.querySelector('#billResults').innerHTML = rows.length
    ? `<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Supplier / bill</th><th>Property</th><th>Due date</th><th>Paid by</th><th class="text-end">Amount</th><th>Status</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>${rows.map((bill) => `<tr>
      <td><strong>${escapeHtml(bill.supplier)}</strong><div class="small text-secondary">${escapeHtml(bill.type)}${bill.accountRef ? ` · ${escapeHtml(bill.accountRef)}` : ''}${bill.attachment ? ` · <i class="bi bi-paperclip"></i> ${escapeHtml(bill.attachment)}` : ''}</div></td>
      <td>${bill.property ? `<a class="text-decoration-none" href="#/properties/${encodeURIComponent(bill.propertyId)}">${escapeHtml(bill.property.name)}</a>` : 'Property unavailable'}</td>
      <td>${formatDate(bill.dueDate)}${bill.computedStatus === 'overdue' ? `<div class="small text-danger">${Math.abs(bill.daysToDue)} days overdue</div>` : ''}</td><td>${escapeHtml(bill.paidBy)}</td><td class="text-end">${formatCurrency(bill.amount, context.data.config)}</td><td>${statusBadge(bill.computedStatus)}</td>
      <td class="text-end text-nowrap">${context.role !== 'accountant' ? `<button class="btn btn-sm btn-light" data-action="edit-bill" data-id="${escapeHtml(bill.id)}" aria-label="Edit bill">Edit</button> ${bill.computedStatus !== 'paid' ? `<button class="btn btn-sm btn-outline-success" data-action="mark-paid" data-id="${escapeHtml(bill.id)}">Mark paid</button>` : ''}` : '<span class="small text-secondary">Read only</span>'}</td>
    </tr>`).join('')}</tbody></table></div>`
    : '<div class="empty-state"><i class="bi bi-receipt"></i>No bills match these filters.</div>';
}

export function renderBills(container, context) {
  const canEdit = context.role !== 'accountant';
  const rows = getRows(context.data);
  const due = rows.filter((bill) => bill.computedStatus !== 'paid');
  container.innerHTML = `<div class="page-header"><div><p class="page-eyebrow">Portfolio</p><h1 class="page-title">Bills</h1><p class="page-subtitle">Track utility and property bills, due dates and attachments.</p></div><div class="d-flex gap-2">${canEdit ? '<button class="btn btn-light border" data-action="scan-bill"><i class="bi bi-stars me-1"></i>AI Scan bill</button><button class="btn btn-forest" data-action="add-bill"><i class="bi bi-plus-lg me-1"></i>Add bill</button>' : '<span class="small text-secondary">Read-only access</span>'}</div></div>
    <div class="row g-3 mb-3"><div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Bills recorded</div><div class="stat-value">${rows.length}</div><div class="stat-hint">Across the portfolio</div></div></div><div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Outstanding</div><div class="stat-value">${formatCurrency(due.reduce((sum, bill) => sum + bill.amount, 0), context.data.config)}</div><div class="stat-hint">${due.length} unpaid bills</div></div></div><div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Overdue</div><div class="stat-value text-danger">${due.filter((bill) => bill.computedStatus === 'overdue').length}</div><div class="stat-hint">${formatCurrency(due.filter((bill) => bill.computedStatus === 'overdue').reduce((sum, bill) => sum + bill.amount, 0), context.data.config)} overdue</div></div></div><div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Paid</div><div class="stat-value text-success">${rows.filter((bill) => bill.computedStatus === 'paid').length}</div><div class="stat-hint">Payment recorded</div></div></div></div>
    <section class="panel-card"><div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3"><div><h2 class="h6 fw-bold mb-1">Bill register</h2><p class="small text-secondary mb-0">Overdue status is calculated using demoToday.</p></div><span class="small text-secondary" id="billCount"></span></div>
      <div class="row g-2 mb-3"><div class="col-lg-6"><label class="visually-hidden" for="billSearch">Search bills</label><input class="form-control form-control-sm" id="billSearch" type="search" placeholder="Search supplier, bill type or reference"></div><div class="col-6 col-lg-3"><label class="visually-hidden" for="billPropertyFilter">Filter by property</label><select class="form-select form-select-sm" id="billPropertyFilter"><option value="">All properties</option>${context.data.properties.map((property) => `<option value="${escapeHtml(property.id)}">${escapeHtml(property.name)}</option>`).join('')}</select></div><div class="col-6 col-lg-3"><label class="visually-hidden" for="billStatusFilter">Filter by status</label><select class="form-select form-select-sm" id="billStatusFilter"><option value="">All statuses</option><option value="unpaid">Unpaid</option><option value="overdue">Overdue</option><option value="paid">Paid</option></select></div></div><div id="billResults"></div></section><div id="billModalHost"></div>`;
  const update = () => renderTable(container, context);
  container.querySelector('#billSearch').addEventListener('input', update);
  container.querySelector('#billPropertyFilter').addEventListener('change', update);
  container.querySelector('#billStatusFilter').addEventListener('change', update);
  update();
  if (!canEdit) return;
  container.onclick = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'add-bill' || button.dataset.action === 'scan-bill') {
      openBillModal(container, context, button.dataset.action === 'scan-bill');
    }
    if (button.dataset.action === 'edit-bill') {
      const bill = context.data.bills.find((item) => item.id === button.dataset.id);
      if (bill) openBillModal(container, context, false, bill);
    }
    if (button.dataset.action === 'mark-paid') {
      const bill = context.data.bills.find((item) => item.id === button.dataset.id);
      if (bill) markBillPaid(bill, context);
    }
  };
}

function openBillModal(container, context, scanMode, bill = null) {
  const host = container.querySelector('#billModalHost');
  host.innerHTML = billModal(context.data, bill, scanMode);
  const modalElement = host.querySelector('#billModal');
  const form = host.querySelector('#billForm');
  if (scanMode) {
    const liveBadge = context.createNeedsLiveBadge('ai', 'Needs live system');
    host.querySelector('#billScanBadge').replaceWith(liveBadge);
    const confirmation = form.querySelector('#billScanConfirm');
    const saveButton = form.querySelector('#saveBillButton');
    form.querySelector('#simulateBillScan').addEventListener('click', () => {
      const propertyId = form.elements.namedItem('propertyId').value;
      if (!propertyId) {
        context.toast('Choose the property before scanning a bill.', 'error');
        return;
      }
      const type = form.elements.namedItem('type').value;
      const existing = context.data.bills.find((item) => item.propertyId === propertyId && item.type === type);
      form.elements.namedItem('supplier').value = existing?.supplier || (type === 'Water' ? 'United Utilities' : 'Octopus Energy');
      form.elements.namedItem('amount').value = existing?.amount || '74.50';
      form.elements.namedItem('dueDate').value = toISODate(new Date(`${context.data.config.demoToday}T00:00:00`));
      form.elements.namedItem('accountRef').value = existing?.accountRef || 'AI-EXTRACT-2026';
      form.querySelector('#billScanReview').classList.remove('d-none');
      form.querySelector('#billScanConfidence').textContent = 'Simulated extraction confidence: 92% · supplier, amount and due date suggested.';
      confirmation.checked = false;
      saveButton.disabled = true;
    });
    confirmation.addEventListener('change', () => { saveButton.disabled = !confirmation.checked; });
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (scanMode && !form.querySelector('#billScanConfirm').checked) {
      context.toast('Review and confirm the AI bill details before saving.', 'error');
      return;
    }
    saveBill(form, context, bill, scanMode, modalElement);
  });
  window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

function saveBill(form, context, existingBill, scanned, modalElement) {
  const values = new FormData(form);
  const propertyId = values.get('propertyId');
  const property = context.data.properties.find((item) => item.id === propertyId);
  const amount = Number(values.get('amount'));
  if (!property || !Number.isFinite(amount) || amount <= 0) {
    context.toast('Choose a valid property and bill amount.', 'error');
    return;
  }
  const bill = existingBill || { id: makeId('bill'), status: 'unpaid' };
  const wasPaid = bill.status === 'paid';
  Object.assign(bill, {
    propertyId,
    type: values.get('type'),
    supplier: values.get('supplier').trim(),
    amount,
    dueDate: values.get('dueDate'),
    paidBy: values.get('paidBy'),
    accountRef: values.get('accountRef').trim() || null,
    attachment: values.get('attachment').trim() || null,
    status: wasPaid ? 'paid' : (values.get('dueDate') < context.data.config.demoToday ? 'overdue' : 'unpaid'),
    aiScanned: Boolean(scanned)
  });
  if (!existingBill) context.data.bills.push(bill);
  if (wasPaid) reconcilePaidBillLedger(bill, context);
  try {
    // Store writes here become the corresponding bills and audit API calls when a backend is introduced.
    context.save('bills', context.data.bills);
    if (wasPaid) context.save('ledger', context.data.ledger);
    context.save('auditLog', [...context.data.auditLog, audit(context, existingBill ? 'Updated' : 'Added', `${existingBill ? 'Updated' : 'Added'} ${bill.type} bill from ${bill.supplier} for ${property.name}${scanned ? ' after review of AI suggestions' : ''}.`)]);
    window.bootstrap.Modal.getInstance(modalElement)?.hide();
    context.refresh();
    context.toast(`${bill.supplier} bill ${existingBill ? 'updated' : 'added'}`);
  } catch (error) {
    context.toast(`Could not save bill: ${error.message}`, 'error');
  }
}

function reconcilePaidBillLedger(bill, context) {
  const priorEntries = context.data.ledger.filter((entry) => entry.linkedBillId === bill.id);
  context.data.ledger = context.data.ledger.filter((entry) => entry.linkedBillId !== bill.id);
  if (bill.paidBy !== 'landlord') return;
  const paymentDate = bill.paidOn || context.data.config.demoToday;
  const expenseEntry = priorEntries.find((entry) => entry.accountId !== 'acc-bank') || { id: makeId('led') };
  const bankEntry = priorEntries.find((entry) => entry.accountId === 'acc-bank') || { id: makeId('led') };
  context.data.ledger.push(
    {
      ...expenseEntry,
      date: paymentDate,
      accountId: expenseAccountForBill(bill.type),
      propertyId: bill.propertyId,
      description: `${bill.type} bill - ${bill.supplier}`,
      debit: bill.amount,
      credit: 0,
      linkedPaymentId: null,
      linkedBillId: bill.id
    },
    {
      ...bankEntry,
      date: paymentDate,
      accountId: 'acc-bank',
      propertyId: bill.propertyId,
      description: `Bill paid - ${bill.supplier}`,
      debit: 0,
      credit: bill.amount,
      linkedPaymentId: null,
      linkedBillId: bill.id
    }
  );
}

function markBillPaid(bill, context) {
  if (bill.status === 'paid') return;
  if (!window.confirm(`Mark the ${formatCurrency(bill.amount, context.data.config)} ${bill.type} bill from ${bill.supplier} as paid?`)) return;
  const property = context.data.properties.find((item) => item.id === bill.propertyId);
  const paymentDate = context.data.config.demoToday;
  bill.status = 'paid';
  bill.paidOn = paymentDate;
  const ledgerEntries = bill.paidBy === 'landlord' ? [
    {
      id: makeId('led'),
      date: paymentDate,
      accountId: expenseAccountForBill(bill.type),
      propertyId: bill.propertyId,
      description: `${bill.type} bill - ${bill.supplier}`,
      debit: bill.amount,
      credit: 0,
      linkedPaymentId: null,
      linkedBillId: bill.id
    },
    {
      id: makeId('led'),
      date: paymentDate,
      accountId: 'acc-bank',
      propertyId: bill.propertyId,
      description: `Bill paid - ${bill.supplier}`,
      debit: 0,
      credit: bill.amount,
      linkedPaymentId: null,
      linkedBillId: bill.id
    }
  ] : [];
  const notification = {
    id: makeId('notification'),
    userId: context.role === 'superadmin' ? 'u-admin' : 'u-manager',
    audience: 'admin',
    title: 'Bill marked paid',
    body: `${bill.supplier} ${bill.type} bill for ${property?.name || 'property'} was recorded as paid.`,
    type: 'system',
    createdOn: paymentDate,
    read: false
  };
  context.data.ledger.push(...ledgerEntries);
  context.data.notifications.push(notification);
  try {
    // Store writes here become the corresponding bill, ledger, notification and audit API calls when a backend is introduced.
    context.save('bills', context.data.bills);
    context.save('ledger', context.data.ledger);
    context.save('notifications', context.data.notifications);
    context.save('auditLog', [...context.data.auditLog, audit(context, 'Marked paid', `${bill.type} bill ${bill.id} from ${bill.supplier} for ${formatCurrency(bill.amount, context.data.config)} marked paid.`)]);
    context.refresh();
    context.toast(bill.paidBy === 'landlord'
      ? `${bill.supplier} bill marked paid and posted to the ledger`
      : `${bill.supplier} bill marked paid by tenant; excluded from landlord ledger`);
  } catch (error) {
    context.toast(`Could not mark bill paid: ${error.message}`, 'error');
  }
}
