import { formatCurrency } from '../../data/helpers/currency.js';
import { formatDate } from '../../data/helpers/date.js';

const ACCOUNT_TYPES = ['Income', 'Expense', 'Liability', 'Asset'];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function getEntries(container, data) {
  const accountId = container.querySelector('#ledgerAccountFilter').value;
  const propertyId = container.querySelector('#ledgerPropertyFilter').value;
  const from = container.querySelector('#ledgerFrom').value;
  const to = container.querySelector('#ledgerTo').value;
  return data.ledger.filter((entry) =>
    (!accountId || entry.accountId === accountId)
    && (!propertyId || entry.propertyId === propertyId)
    && (!from || entry.date >= from)
    && (!to || entry.date <= to)
  ).sort((a, b) => b.date.localeCompare(a.date));
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function renderAccountTable(container, data) {
  const balances = new Map(data.accounts.map((account) => [account.id, { debit: 0, credit: 0 }]));
  for (const entry of data.ledger) {
    const balance = balances.get(entry.accountId);
    if (balance) {
      balance.debit += Number(entry.debit || 0);
      balance.credit += Number(entry.credit || 0);
    }
  }
  container.querySelector('#accountRows').innerHTML = data.accounts.length
    ? data.accounts.map((account) => {
      const balance = balances.get(account.id);
      const total = ['Income', 'Liability'].includes(account.type) ? balance.credit - balance.debit : balance.debit - balance.credit;
      return `<tr><td class="fw-semibold">${escapeHtml(account.code)}</td><td>${escapeHtml(account.name)}</td><td>${escapeHtml(account.type)}</td><td class="text-end">${formatCurrency(total, data.config)}</td><td class="text-end">${data.role !== 'accountant' ? `<button class="btn btn-sm btn-light" data-action="edit-account" data-id="${escapeHtml(account.id)}" aria-label="Edit ${escapeHtml(account.name)}"><i class="bi bi-pencil"></i></button>` : ''}</td></tr>`;
    }).join('')
    : '<tr><td colspan="5" class="text-center text-secondary py-4">No accounts configured.</td></tr>';
}

function renderLedger(container, data) {
  const accounts = new Map(data.accounts.map((account) => [account.id, account]));
  const properties = new Map(data.properties.map((property) => [property.id, property]));
  const rows = getEntries(container, data);
  const income = rows.reduce((total, entry) => total + (accounts.get(entry.accountId)?.type === 'Income' ? Number(entry.credit || 0) - Number(entry.debit || 0) : 0), 0);
  const expenses = rows.reduce((total, entry) => total + (accounts.get(entry.accountId)?.type === 'Expense' ? Number(entry.debit || 0) - Number(entry.credit || 0) : 0), 0);
  container.querySelector('#ledgerCount').textContent = `${rows.length} entries`;
  container.querySelector('#ledgerIncome').textContent = formatCurrency(income, data.config);
  container.querySelector('#ledgerExpenses').textContent = formatCurrency(expenses, data.config);
  container.querySelector('#ledgerNet').textContent = formatCurrency(income - expenses, data.config);
  container.querySelector('#ledgerRows').innerHTML = rows.length
    ? rows.map((entry) => `<tr><td>${formatDate(entry.date)}</td><td>${escapeHtml(entry.description)}</td><td>${escapeHtml(accounts.get(entry.accountId)?.name || 'Unknown account')}</td><td>${escapeHtml(properties.get(entry.propertyId)?.name || 'Portfolio')}</td><td class="text-end">${Number(entry.debit) ? formatCurrency(entry.debit, data.config) : '—'}</td><td class="text-end">${Number(entry.credit) ? formatCurrency(entry.credit, data.config) : '—'}</td></tr>`).join('')
    : '<tr><td colspan="6"><div class="empty-state"><i class="bi bi-journal-x"></i>No ledger entries match these filters.</div></td></tr>';
  renderPropertyProfit(container, data, rows);
}

function renderPropertyProfit(container, data, entries) {
  const accounts = new Map(data.accounts.map((account) => [account.id, account]));
  const totals = new Map(data.properties.map((property) => [property.id, { income: 0, expenses: 0 }]));
  for (const entry of entries) {
    const summary = totals.get(entry.propertyId);
    if (!summary) continue;
    const type = accounts.get(entry.accountId)?.type;
    if (type === 'Income') summary.income += Number(entry.credit || 0) - Number(entry.debit || 0);
    if (type === 'Expense') summary.expenses += Number(entry.debit || 0) - Number(entry.credit || 0);
  }
  container.querySelector('#propertyProfitRows').innerHTML = data.properties.map((property) => {
    const totalsForProperty = totals.get(property.id);
    return `<tr><td>${escapeHtml(property.name)}</td><td class="text-end">${formatCurrency(totalsForProperty.income, data.config)}</td><td class="text-end">${formatCurrency(totalsForProperty.expenses, data.config)}</td><td class="text-end fw-semibold">${formatCurrency(totalsForProperty.income - totalsForProperty.expenses, data.config)}</td></tr>`;
  }).join('');
}

function accountModal(account = null) {
  return `<div class="modal fade" id="accountModal" tabindex="-1" aria-labelledby="accountModalTitle" aria-hidden="true"><div class="modal-dialog"><form class="modal-content" id="accountForm">
    <div class="modal-header"><h2 class="modal-title fs-5" id="accountModalTitle">${account ? 'Edit account' : 'Add account'}</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
    <div class="modal-body"><div class="row g-3"><div class="col-4"><label class="form-label" for="accountCode">Code</label><input class="form-control" id="accountCode" name="code" maxlength="12" value="${escapeHtml(account?.code || '')}" required></div><div class="col-8"><label class="form-label" for="accountName">Account name</label><input class="form-control" id="accountName" name="name" maxlength="80" value="${escapeHtml(account?.name || '')}" required></div><div class="col-12"><label class="form-label" for="accountType">Type</label><select class="form-select" id="accountType" name="type">${ACCOUNT_TYPES.map((type) => `<option ${account?.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select></div></div><p class="small text-secondary mt-3 mb-0">Accounts with existing transactions can be renamed, but changing their type changes how balances are presented.</p></div>
    <div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-forest">Save account</button></div></form></div></div>`;
}

export function renderAccounts(container, context) {
  const canEdit = context.role !== 'accountant';
  container.innerHTML = `<div class="page-header"><div><p class="page-eyebrow">Finance</p><h1 class="page-title">Accounts</h1><p class="page-subtitle">Chart of accounts, double-entry ledger and filtered profit and loss.</p></div><div class="d-flex gap-2"><button class="btn btn-light border" data-action="export-ledger"><i class="bi bi-download me-1"></i>Export CSV</button>${canEdit ? '<button class="btn btn-forest" data-action="add-account"><i class="bi bi-plus-lg me-1"></i>Add account</button>' : '<span class="small text-secondary align-self-center">Read-only access</span>'}</div></div>
    <div class="row g-3 mb-3"><div class="col-md-4"><div class="stat-card"><div class="stat-label">Income in filtered ledger</div><div class="stat-value text-success" id="ledgerIncome">£0.00</div></div></div><div class="col-md-4"><div class="stat-card"><div class="stat-label">Expenses in filtered ledger</div><div class="stat-value text-danger" id="ledgerExpenses">£0.00</div></div></div><div class="col-md-4"><div class="stat-card"><div class="stat-label">Net operating result</div><div class="stat-value" id="ledgerNet">£0.00</div></div></div></div>
    <section class="panel-card mb-3"><div class="d-flex justify-content-between align-items-center mb-3"><div><h2 class="h6 fw-bold mb-1">Chart of accounts</h2><p class="small text-secondary mb-0">Balances are calculated from posted ledger entries.</p></div></div><div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Code</th><th>Account</th><th>Type</th><th class="text-end">Balance</th><th></th></tr></thead><tbody id="accountRows"></tbody></table></div></section>
    <section class="panel-card mb-3"><div class="d-flex justify-content-between align-items-center mb-3"><div><h2 class="h6 fw-bold mb-1">Property profit and loss</h2><p class="small text-secondary mb-0">Summarised from the selected ledger date and property filters.</p></div></div><div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Property</th><th class="text-end">Income</th><th class="text-end">Expenses</th><th class="text-end">Net</th></tr></thead><tbody id="propertyProfitRows"></tbody></table></div></section>
    <section class="panel-card"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><div><h2 class="h6 fw-bold mb-1">General ledger</h2><p class="small text-secondary mb-0">Filter transactions and export the current view.</p></div><span id="ledgerCount" class="small text-secondary"></span></div>
      <div class="row g-2 mb-3"><div class="col-6 col-lg-3"><label class="visually-hidden" for="ledgerAccountFilter">Filter account</label><select class="form-select form-select-sm" id="ledgerAccountFilter"><option value="">All accounts</option>${context.data.accounts.map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.code)} · ${escapeHtml(account.name)}</option>`).join('')}</select></div><div class="col-6 col-lg-3"><label class="visually-hidden" for="ledgerPropertyFilter">Filter property</label><select class="form-select form-select-sm" id="ledgerPropertyFilter"><option value="">All properties</option>${context.data.properties.map((property) => `<option value="${escapeHtml(property.id)}">${escapeHtml(property.name)}</option>`).join('')}</select></div><div class="col-6 col-lg-3"><label class="form-label small mb-1" for="ledgerFrom">From</label><input class="form-control form-control-sm" id="ledgerFrom" type="date"></div><div class="col-6 col-lg-3"><label class="form-label small mb-1" for="ledgerTo">To</label><input class="form-control form-control-sm" id="ledgerTo" type="date" max="${escapeHtml(context.data.config.demoToday)}"></div></div>
      <div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Date</th><th>Description</th><th>Account</th><th>Property</th><th class="text-end">Debit</th><th class="text-end">Credit</th></tr></thead><tbody id="ledgerRows"></tbody></table></div>
    </section><div id="accountModalHost"></div>`;
  renderAccountTable(container, { ...context.data, role: context.role });
  const update = () => renderLedger(container, context.data);
  for (const selector of ['#ledgerAccountFilter', '#ledgerPropertyFilter', '#ledgerFrom', '#ledgerTo']) {
    container.querySelector(selector).addEventListener('change', update);
  }
  update();
  container.onclick = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'export-ledger') {
      const accounts = new Map(context.data.accounts.map((account) => [account.id, account]));
      const properties = new Map(context.data.properties.map((property) => [property.id, property]));
      const rows = getEntries(container, context.data).map((entry) => [
        entry.date, entry.description, accounts.get(entry.accountId)?.name || '',
        properties.get(entry.propertyId)?.name || '', entry.debit, entry.credit
      ]);
      downloadCsv('landlord-desk-ledger.csv', [['Date', 'Description', 'Account', 'Property', 'Debit GBP', 'Credit GBP'], ...rows]);
      context.toast('Filtered ledger exported to CSV');
    }
    if (canEdit && (button.dataset.action === 'add-account' || button.dataset.action === 'edit-account')) {
      const account = context.data.accounts.find((item) => item.id === button.dataset.id) || null;
      openAccountModal(container, context, account);
    }
  };
}

function openAccountModal(container, context, account) {
  const host = container.querySelector('#accountModalHost');
  host.innerHTML = accountModal(account);
  const modalElement = host.querySelector('#accountModal');
  const form = host.querySelector('#accountForm');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const code = values.get('code').trim();
    const name = values.get('name').trim();
    if (context.data.accounts.some((item) => item.code === code && item.id !== account?.id)) {
      context.toast('That account code is already in use.', 'error');
      return;
    }
    const savedAccount = account || { id: makeId('acc') };
    Object.assign(savedAccount, { code, name, type: values.get('type') });
    if (!account) context.data.accounts.push(savedAccount);
    try {
      // This store write becomes the chart-of-accounts API call when a backend is introduced.
      context.save('accounts', context.data.accounts);
      context.save('auditLog', [...context.data.auditLog, {
        id: makeId('audit'),
        date: `${context.data.config.demoToday}T12:00:00`,
        userName: context.role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
        action: account ? 'Updated' : 'Added',
        entity: 'Account',
        detail: `${account ? 'Updated' : 'Added'} account ${code} · ${name}.`
      }]);
      window.bootstrap.Modal.getInstance(modalElement)?.hide();
      context.refresh();
      context.toast(`${name} account ${account ? 'updated' : 'added'}`);
    } catch (error) {
      context.toast(`Could not save account: ${error.message}`, 'error');
    }
  });
  window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
}
