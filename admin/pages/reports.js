import { formatCurrency } from '../../data/helpers/currency.js';
import { daysBetween, formatDate } from '../../data/helpers/date.js';
import { getDocumentStatus, getRentStatus } from '../../data/helpers/status.js';

const REPORTS = ['rent', 'compliance', 'income'];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
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

function makeReport(report, data, from, to) {
  const properties = new Map(data.properties.map((property) => [property.id, property]));
  const tenants = new Map(data.tenants.map((tenant) => [tenant.id, tenant]));
  const accounts = new Map(data.accounts.map((account) => [account.id, account]));
  if (report === 'rent') {
    const rows = data.rentSchedule.filter((item) =>
      (!from || item.dueDate >= from) && (!to || item.dueDate <= to)
    ).map((item) => ({
      'Due date': formatDate(item.dueDate),
      Tenant: tenants.get(item.tenantId)?.name || 'Tenant unavailable',
      Property: properties.get(item.propertyId)?.name || 'Property unavailable',
      'Amount GBP': Number(item.amount),
      'Paid GBP': Number(item.paidAmount || 0),
      'Balance GBP': Math.max(0, Number(item.amount) - Number(item.paidAmount || 0)),
      Status: getRentStatus(item, data.config)
    }));
    return { title: 'Rent collection report', columns: Object.keys(rows[0] || { 'Due date': '', Tenant: '', Property: '', 'Amount GBP': '', 'Paid GBP': '', 'Balance GBP': '', Status: '' }), rows };
  }
  if (report === 'compliance') {
    const types = new Map(data.documentTypes.map((type) => [type.id, type.name]));
    const rows = data.documents.filter((item) =>
      (!from || item.expiryDate >= from) && (!to || item.expiryDate <= to)
    ).map((item) => ({
      Document: types.get(item.type) || item.type,
      File: item.fileName,
      Property: properties.get(item.propertyId)?.name || 'Property unavailable',
      'Expiry date': formatDate(item.expiryDate),
      Status: getDocumentStatus(item, data.config),
      'Days remaining': daysBetween(data.config.demoToday, item.expiryDate)
    }));
    return { title: 'Compliance report', columns: Object.keys(rows[0] || { Document: '', File: '', Property: '', 'Expiry date': '', Status: '', 'Days remaining': '' }), rows };
  }
  const rows = data.ledger.filter((entry) =>
    (!from || entry.date >= from) && (!to || entry.date <= to)
  ).map((entry) => ({
    Date: formatDate(entry.date),
    Description: entry.description,
    Account: accounts.get(entry.accountId)?.name || 'Account unavailable',
    Property: properties.get(entry.propertyId)?.name || 'Portfolio',
    'Income GBP': accounts.get(entry.accountId)?.type === 'Income' ? Number(entry.credit || 0) - Number(entry.debit || 0) : 0,
    'Expense GBP': accounts.get(entry.accountId)?.type === 'Expense' ? Number(entry.debit || 0) - Number(entry.credit || 0) : 0
  }));
  return { title: 'Income and expense report', columns: Object.keys(rows[0] || { Date: '', Description: '', Account: '', Property: '', 'Income GBP': '', 'Expense GBP': '' }), rows };
}

function renderReport(container, data, report) {
  const from = container.querySelector('#reportFrom').value;
  const to = container.querySelector('#reportTo').value;
  const result = makeReport(report, data, from, to);
  const income = result.rows.reduce((sum, row) => sum + Number(row['Income GBP'] || 0), 0);
  const expenses = result.rows.reduce((sum, row) => sum + Number(row['Expense GBP'] || 0), 0);
  const due = result.rows.reduce((sum, row) => sum + Number(row['Amount GBP'] || 0), 0);
  const paid = result.rows.reduce((sum, row) => sum + Number(row['Paid GBP'] || 0), 0);
  container.querySelector('#reportSummary').innerHTML = report === 'income'
    ? `<div class="row g-3"><div class="col-md-4"><div class="stat-card"><div class="stat-label">Income</div><div class="stat-value text-success">${formatCurrency(income, data.config)}</div></div></div><div class="col-md-4"><div class="stat-card"><div class="stat-label">Expenses</div><div class="stat-value text-danger">${formatCurrency(expenses, data.config)}</div></div></div><div class="col-md-4"><div class="stat-card"><div class="stat-label">Net result</div><div class="stat-value">${formatCurrency(income - expenses, data.config)}</div></div></div></div>`
    : report === 'rent'
      ? `<div class="row g-3"><div class="col-md-4"><div class="stat-card"><div class="stat-label">Scheduled rent</div><div class="stat-value">${formatCurrency(due, data.config)}</div></div></div><div class="col-md-4"><div class="stat-card"><div class="stat-label">Recorded payments</div><div class="stat-value text-success">${formatCurrency(paid, data.config)}</div></div></div><div class="col-md-4"><div class="stat-card"><div class="stat-label">Outstanding balance</div><div class="stat-value text-danger">${formatCurrency(result.rows.reduce((sum, row) => sum + Number(row['Balance GBP'] || 0), 0), data.config)}</div></div></div></div>`
      : `<div class="row g-3"><div class="col-md-4"><div class="stat-card"><div class="stat-label">Documents</div><div class="stat-value">${result.rows.length}</div></div></div>${['expired', 'expiring', 'valid'].map((status) => `<div class="col-md-4"><div class="stat-card"><div class="stat-label">${status[0].toUpperCase()}${status.slice(1)}</div><div class="stat-value">${result.rows.filter((row) => row.Status === status).length}</div></div></div>`).join('')}</div>`;
  container.querySelector('#reportTitle').textContent = result.title;
  container.querySelector('#reportCount').textContent = `${result.rows.length} rows`;
  container.querySelector('#reportTable').innerHTML = result.rows.length
    ? `<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr>${result.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${result.rows.map((row) => `<tr>${result.columns.map((column) => `<td>${escapeHtml(typeof row[column] === 'number' && column.endsWith('GBP') ? formatCurrency(row[column], data.config) : row[column])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    : '<div class="empty-state"><i class="bi bi-bar-chart"></i>No report rows match this date range.</div>';
}

export function renderReports(container, context) {
  let report = 'rent';
  container.innerHTML = `<div class="page-header"><div><p class="page-eyebrow">Finance</p><h1 class="page-title">Reports</h1><p class="page-subtitle">Rent collection, compliance, and income and expense summaries.</p></div></div>
    <div class="btn-group mb-3" role="group" aria-label="Report type">${REPORTS.map((item) => `<button type="button" class="btn ${item === report ? 'btn-forest' : 'btn-light border'}" data-report="${item}" aria-pressed="${item === report}">${item === 'rent' ? 'Rent collection' : item === 'compliance' ? 'Compliance' : 'Income and expenses'}</button>`).join('')}</div>
    <section class="panel-card"><div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3"><div><h2 class="h6 fw-bold mb-1" id="reportTitle"></h2><p class="small text-secondary mb-0">Dates are formatted for the UK; status calculations use the configured demo date.</p></div><div class="d-flex gap-2"><button class="btn btn-sm btn-light border" data-action="print"><i class="bi bi-printer me-1"></i>Print</button><button class="btn btn-sm btn-forest" data-action="export"><i class="bi bi-download me-1"></i>Export CSV</button></div></div>
      <div class="row g-2 mb-3"><div class="col-6 col-md-3"><label class="form-label small mb-1" for="reportFrom">From</label><input class="form-control form-control-sm" type="date" id="reportFrom"></div><div class="col-6 col-md-3"><label class="form-label small mb-1" for="reportTo">To</label><input class="form-control form-control-sm" type="date" id="reportTo" max="${escapeHtml(context.data.config.demoToday)}"></div><div class="col-12 col-md-6 d-flex align-items-end justify-content-md-end"><span class="small text-secondary" id="reportCount"></span></div></div>
      <div id="reportSummary" class="mb-3"></div><div id="reportTable"></div>
    </section>`;
  const update = () => renderReport(container, context.data, report);
  container.querySelector('#reportFrom').addEventListener('change', update);
  container.querySelector('#reportTo').addEventListener('change', update);
  container.querySelectorAll('[data-report]').forEach((button) => button.addEventListener('click', () => {
    report = button.dataset.report;
    container.querySelectorAll('[data-report]').forEach((item) => {
      item.className = `btn ${item === button ? 'btn-forest' : 'btn-light border'}`;
      item.setAttribute('aria-pressed', String(item === button));
    });
    update();
  }));
  container.onclick = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const result = makeReport(report, context.data, container.querySelector('#reportFrom').value, container.querySelector('#reportTo').value);
    if (button.dataset.action === 'print') window.print();
    if (button.dataset.action === 'export') {
      downloadCsv(`landlord-desk-${report}-report.csv`, [result.columns, ...result.rows.map((row) => result.columns.map((column) => row[column]))]);
      context.toast(`${result.title} exported to CSV`);
    }
  };
  update();
}
