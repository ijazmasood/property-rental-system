import { formatCurrency } from '../../data/helpers/currency.js';
import { daysBetween, formatDate } from '../../data/helpers/date.js';
import { getBillStatus, getDocumentStatus, getRentStatus } from '../../data/helpers/status.js';

const PROPERTY_TYPES = ['Flat', 'Terraced house', 'Semi-detached house', 'Detached house', 'Maisonette', 'Bungalow', 'Other'];
const DEPOSIT_SCHEMES = ['TDS', 'DPS', 'MyDeposits', 'Other'];
const PROFILE_TABS = [
  ['overview', 'Overview', 'bi-grid'],
  ['tenant', 'Tenant', 'bi-person'],
  ['documents', 'Documents', 'bi-file-earmark-text'],
  ['rent', 'Rent history', 'bi-cash-coin'],
  ['bills', 'Bills', 'bi-receipt'],
  ['issues', 'Issues', 'bi-tools'],
  ['finance', 'Finance', 'bi-graph-up'],
  ['notes', 'Notes', 'bi-journal-text']
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function id(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function statusBadge(status, labels = {}) {
  const tone = {
    occupied: 'success',
    vacant: 'secondary',
    paid: 'success',
    valid: 'success',
    upcoming: 'primary',
    expiring: 'warning',
    partial: 'warning',
    overdue: 'danger',
    expired: 'danger',
    unpaid: 'warning',
    open: 'warning',
    'in progress': 'primary',
    'awaiting tenant': 'info',
    resolved: 'success',
    closed: 'secondary',
    active: 'success',
    ended: 'secondary',
    pending: 'warning'
  }[status] || 'secondary';
  return `<span class="badge text-bg-${tone} bg-opacity-10 text-${tone} border border-${tone} border-opacity-10">${escapeHtml(labels[status] || status)}</span>`;
}

function propertyTenant(propertyId, data) {
  return data.tenants.find((tenant) => tenant.propertyId === propertyId && tenant.status === 'active');
}

function propertyLinkedCount(propertyId, data) {
  return [
    data.tenants.some((row) => row.propertyId === propertyId),
    data.documents.some((row) => row.propertyId === propertyId),
    data.rentSchedule.some((row) => row.propertyId === propertyId),
    data.bills.some((row) => row.propertyId === propertyId),
    data.issues.some((row) => row.propertyId === propertyId),
    data.contracts.some((row) => row.propertyId === propertyId),
    data.ledger.some((row) => row.propertyId === propertyId)
  ].filter(Boolean).length;
}

function auditRow(data, role, action, entity, detail) {
  const user = {
    superadmin: 'Helen Foster',
    admin: 'Martin Cole',
    accountant: 'Nina Patel'
  }[role];
  return {
    id: id('audit'),
    date: `${data.config.demoToday}T12:00:00`,
    userName: user,
    action,
    entity,
    detail
  };
}

function propertyForm(property, role) {
  const editing = Boolean(property);
  const readOnly = role === 'accountant';
  const value = (field) => escapeHtml(property?.[field] ?? '');
  return `
    <div class="modal fade" id="propertyModal" tabindex="-1" aria-labelledby="propertyModalTitle" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <form class="modal-content" id="propertyForm">
          <div class="modal-header"><h2 class="modal-title fs-5" id="propertyModalTitle">${editing ? 'Edit property' : 'Add property'}</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-md-7"><label class="form-label" for="propertyName">Property name</label><input class="form-control" id="propertyName" name="name" required maxlength="80" value="${value('name')}" ${readOnly ? 'disabled' : ''}></div>
              <div class="col-md-5"><label class="form-label" for="propertyType">Type</label><select class="form-select" id="propertyType" name="type" required ${readOnly ? 'disabled' : ''}>${PROPERTY_TYPES.map((type) => `<option ${property?.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select></div>
              <div class="col-md-8"><label class="form-label" for="propertyAddress">Address</label><input class="form-control" id="propertyAddress" name="address" required maxlength="140" value="${value('address')}" ${readOnly ? 'disabled' : ''}></div>
              <div class="col-md-4"><label class="form-label" for="propertyPostcode">Postcode</label><input class="form-control text-uppercase" id="propertyPostcode" name="postcode" required maxlength="10" pattern="[A-Za-z]{1,2}[0-9][A-Za-z0-9]?[ ]?[0-9][A-Za-z]{2}" value="${value('postcode')}" ${readOnly ? 'disabled' : ''}></div>
              <div class="col-md-3"><label class="form-label" for="propertyBedrooms">Bedrooms</label><input class="form-control" id="propertyBedrooms" name="bedrooms" type="number" min="0" max="20" required value="${property?.bedrooms ?? 1}" ${readOnly ? 'disabled' : ''}></div>
              <div class="col-md-3"><label class="form-label" for="propertyRent">Monthly rent (£)</label><input class="form-control" id="propertyRent" name="monthlyRent" type="number" min="0" step="0.01" required value="${property?.monthlyRent ?? ''}" ${readOnly ? 'disabled' : ''}></div>
              <div class="col-md-3"><label class="form-label" for="propertyDeposit">Deposit (£)</label><input class="form-control" id="propertyDeposit" name="deposit" type="number" min="0" step="0.01" required value="${property?.deposit ?? ''}" ${readOnly ? 'disabled' : ''}></div>
              <div class="col-md-3"><label class="form-label" for="propertyStatus">Status</label><select class="form-select" id="propertyStatus" name="status" ${readOnly ? 'disabled' : ''}><option value="occupied" ${property?.status === 'occupied' ? 'selected' : ''}>Occupied</option><option value="vacant" ${property?.status === 'vacant' ? 'selected' : ''}>Vacant</option></select></div>
              <div class="col-md-4"><label class="form-label" for="propertyScheme">Deposit scheme</label><select class="form-select" id="propertyScheme" name="depositScheme" ${readOnly ? 'disabled' : ''}>${DEPOSIT_SCHEMES.map((scheme) => `<option ${property?.depositScheme === scheme ? 'selected' : ''}>${scheme}</option>`).join('')}</select></div>
              <div class="col-md-4"><label class="form-label" for="propertyDepositRef">Deposit reference</label><input class="form-control" id="propertyDepositRef" name="depositRef" maxlength="40" value="${value('depositRef')}" ${readOnly ? 'disabled' : ''}></div>
              <div class="col-md-4"><label class="form-label" for="propertyEpc">EPC rating</label><select class="form-select" id="propertyEpc" name="epcRating" ${readOnly ? 'disabled' : ''}>${['A','B','C','D','E','F','G'].map((rating) => `<option ${property?.epcRating === rating ? 'selected' : ''}>${rating}</option>`).join('')}</select></div>
              <div class="col-12"><label class="form-label" for="propertyNotes">Notes</label><textarea class="form-control" id="propertyNotes" name="notes" rows="3" maxlength="1000" ${readOnly ? 'disabled' : ''}>${value('notes')}</textarea></div>
            </div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>${readOnly ? '<span class="small text-secondary">Accountant view is read-only.</span>' : `<button type="submit" class="btn btn-forest">${editing ? 'Save changes' : 'Add property'}</button>`}</div>
        </form>
      </div>
    </div>`;
}

function propertyFormValues(form) {
  const fields = new FormData(form);
  return {
    name: fields.get('name').trim(),
    type: fields.get('type'),
    address: fields.get('address').trim(),
    postcode: fields.get('postcode').trim().toUpperCase(),
    bedrooms: Number(fields.get('bedrooms')),
    monthlyRent: Number(fields.get('monthlyRent')),
    deposit: Number(fields.get('deposit')),
    depositScheme: fields.get('depositScheme'),
    depositRef: fields.get('depositRef').trim(),
    status: fields.get('status'),
    epcRating: fields.get('epcRating'),
    notes: fields.get('notes').trim()
  };
}

function propertyListTemplate(data, role) {
  const totalRent = data.properties.reduce((sum, property) => sum + property.monthlyRent, 0);
  return `
    <div class="page-header">
      <div><p class="page-eyebrow">Portfolio</p><h1 class="page-title">Properties</h1><p class="page-subtitle">Manage your homes, tenancy details and property records.</p></div>
      <div class="d-flex align-items-center gap-2">${role !== 'accountant' ? '<button class="btn btn-forest" data-action="add-property"><i class="bi bi-plus-lg me-1"></i>Add property</button>' : '<span class="small text-secondary">Read-only access</span>'}</div>
    </div>
    <div class="row g-3 mb-3">
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Properties</div><div class="stat-value">${data.properties.length}</div><div class="stat-hint">${data.properties.filter((property) => property.status === 'occupied').length} occupied</div></div></div>
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Vacant</div><div class="stat-value">${data.properties.filter((property) => property.status === 'vacant').length}</div><div class="stat-hint">Available to let</div></div></div>
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Bedrooms</div><div class="stat-value">${data.properties.reduce((sum, property) => sum + property.bedrooms, 0)}</div><div class="stat-hint">Across the portfolio</div></div></div>
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Monthly rent roll</div><div class="stat-value">${formatCurrency(totalRent, data.config)}</div><div class="stat-hint">At current listed rents</div></div></div>
    </div>
    <section class="panel-card">
      <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <div class="input-group input-group-sm" style="width:min(100%, 320px)"><span class="input-group-text bg-white"><i class="bi bi-search"></i></span><input type="search" class="form-control" id="propertyFilter" placeholder="Search name, address or postcode" aria-label="Search properties"></div>
          <select class="form-select form-select-sm" id="propertyStatusFilter" aria-label="Filter by property status" style="width:150px"><option value="">All statuses</option><option value="occupied">Occupied</option><option value="vacant">Vacant</option></select>
        </div>
        <div class="btn-group btn-group-sm" role="group" aria-label="Property layout">
          <button class="btn btn-outline-secondary active" type="button" data-view="table" aria-pressed="true"><i class="bi bi-list-ul me-1"></i>List</button>
          <button class="btn btn-outline-secondary" type="button" data-view="cards" aria-pressed="false"><i class="bi bi-grid me-1"></i>Cards</button>
        </div>
      </div>
      <div id="propertyResults"></div>
    </section>
    ${propertyForm(null, role)}`;
}

function propertyRows(data, properties, view, role) {
  if (!properties.length) return '<div class="empty-state"><i class="bi bi-buildings"></i>No properties match these filters.</div>';
  const tenantsByProperty = new Map(data.tenants.map((tenant) => [tenant.propertyId, tenant]));
  if (view === 'cards') {
    return `<div class="row g-3">${properties.map((property) => {
      const tenant = tenantsByProperty.get(property.id);
      return `<div class="col-md-6 col-xl-4"><article class="card h-100 border-0 shadow-sm">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start gap-2"><a class="h5 text-decoration-none fw-bold mb-1" href="#/properties/${encodeURIComponent(property.id)}">${escapeHtml(property.name)}</a>${statusBadge(property.status)}</div>
          <div class="small text-secondary mb-3">${escapeHtml(property.address)}<br>${escapeHtml(property.postcode)}</div>
          <div class="d-flex justify-content-between small"><span>${property.bedrooms} bedrooms · ${escapeHtml(property.type)}</span><strong>${formatCurrency(property.monthlyRent, data.config)} pcm</strong></div>
          <div class="border-top mt-3 pt-3 small text-secondary">${tenant ? `${escapeHtml(tenant.name)} · Tenant` : 'No current tenant'}</div>
        </div><div class="card-footer bg-white border-0 pt-0 d-flex justify-content-between"><a href="#/properties/${encodeURIComponent(property.id)}" class="btn btn-sm btn-light">View property</a>${role !== 'accountant' ? `<button class="btn btn-sm btn-link" data-action="edit-property" data-id="${escapeHtml(property.id)}">Edit</button>` : ''}</div>
      </article></div>`;
    }).join('')}</div>`;
  }

  return `<div class="table-responsive"><table class="table align-middle mb-0">
    <thead><tr><th>Property</th><th>Type</th><th>Tenant</th><th>Status</th><th class="text-end">Monthly rent</th><th><span class="visually-hidden">Actions</span></th></tr></thead>
    <tbody>${properties.map((property) => {
      const tenant = tenantsByProperty.get(property.id);
      return `<tr>
        <td><a class="fw-semibold text-decoration-none" href="#/properties/${encodeURIComponent(property.id)}">${escapeHtml(property.name)}</a><div class="small text-secondary">${escapeHtml(property.address)}, ${escapeHtml(property.postcode)}</div></td>
        <td>${escapeHtml(property.type)}<div class="small text-secondary">${property.bedrooms} bedrooms</div></td>
        <td>${tenant ? `<a href="#/tenants/${encodeURIComponent(tenant.id)}" class="text-decoration-none">${escapeHtml(tenant.name)}</a>` : '<span class="text-secondary">—</span>'}</td>
        <td>${statusBadge(property.status)}</td><td class="text-end fw-semibold">${formatCurrency(property.monthlyRent, data.config)}</td>
        <td class="text-end text-nowrap"><a class="btn btn-sm btn-light" href="#/properties/${encodeURIComponent(property.id)}" aria-label="View ${escapeHtml(property.name)}">View</a>${role !== 'accountant' ? ` <button class="btn btn-sm btn-light" data-action="edit-property" data-id="${escapeHtml(property.id)}" aria-label="Edit ${escapeHtml(property.name)}"><i class="bi bi-pencil"></i></button>` : ''}</td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

function applyPropertyFilters(container, data, role) {
  const query = container.querySelector('#propertyFilter').value.trim().toLowerCase();
  const status = container.querySelector('#propertyStatusFilter').value;
  const view = container.dataset.view || 'table';
  const properties = data.properties.filter((property) => {
    const matchesQuery = `${property.name} ${property.address} ${property.postcode}`.toLowerCase().includes(query);
    return matchesQuery && (!status || property.status === status);
  });
  container.querySelector('#propertyResults').innerHTML = propertyRows(data, properties, view, role);
}

function tabLink(propertyId, tab, label, icon, active) {
  return `<a class="nav-link${active ? ' active' : ''}" href="#/properties/${encodeURIComponent(propertyId)}?tab=${tab}"${active ? ' aria-current="page"' : ''}><i class="bi ${icon} me-1"></i>${label}</a>`;
}

function profileOverview(property, data, tenant, linked) {
  const nextRent = data.rentSchedule
    .filter((rent) => rent.propertyId === property.id && getRentStatus(rent, data.config) !== 'paid')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  return `
    <div class="row g-3">
      <div class="col-lg-7"><section class="panel-card h-100"><h2 class="h6 fw-bold mb-3">Property details</h2><dl class="row mb-0 small">
        <dt class="col-sm-4 text-secondary">Address</dt><dd class="col-sm-8">${escapeHtml(property.address)}, ${escapeHtml(property.postcode)}</dd>
        <dt class="col-sm-4 text-secondary">Property type</dt><dd class="col-sm-8">${escapeHtml(property.type)} · ${property.bedrooms} bedrooms</dd>
        <dt class="col-sm-4 text-secondary">EPC rating</dt><dd class="col-sm-8">${escapeHtml(property.epcRating)}</dd>
        <dt class="col-sm-4 text-secondary">Deposit scheme</dt><dd class="col-sm-8">${escapeHtml(property.depositScheme)} · ${escapeHtml(property.depositRef)}</dd>
        <dt class="col-sm-4 text-secondary">Deposit held</dt><dd class="col-sm-8">${formatCurrency(property.deposit, data.config)}</dd>
      </dl></section></div>
      <div class="col-lg-5"><section class="panel-card h-100"><h2 class="h6 fw-bold mb-3">Tenancy at a glance</h2>
        ${tenant ? `<div class="d-flex align-items-center gap-3"><span class="user-avatar">${escapeHtml(tenant.name.split(' ').map((part) => part[0]).join('').slice(0, 2))}</span><div><a class="fw-semibold text-decoration-none" href="#/tenants/${encodeURIComponent(tenant.id)}">${escapeHtml(tenant.name)}</a><div class="small text-secondary">${escapeHtml(tenant.email)}</div></div></div><hr><div class="d-flex justify-content-between small"><span class="text-secondary">Tenancy dates</span><span>${formatDate(tenant.tenancyStart)} – ${formatDate(tenant.tenancyEnd)}</span></div><div class="d-flex justify-content-between small mt-2"><span class="text-secondary">Rent due</span><span>${tenant.rentDueDay}${ordinal(tenant.rentDueDay)} of each month</span></div>` : '<div class="empty-state"><i class="bi bi-house-add"></i>This property has no current tenant.</div>'}
        <hr><div class="d-flex justify-content-between small"><span class="text-secondary">Monthly rent</span><strong>${formatCurrency(property.monthlyRent, data.config)}</strong></div>
        ${nextRent ? `<div class="d-flex justify-content-between small mt-2"><span class="text-secondary">Next schedule entry</span><span>${formatDate(nextRent.dueDate)} · ${statusBadge(getRentStatus(nextRent, data.config))}</span></div>` : ''}
      </section></div>
      <div class="col-12"><section class="panel-card"><div class="d-flex justify-content-between"><h2 class="h6 fw-bold">Portfolio records</h2><span class="small text-secondary">${linked} linked record groups</span></div><p class="small text-secondary mb-0">This property has ${data.documents.filter((row) => row.propertyId === property.id).length} documents, ${data.rentSchedule.filter((row) => row.propertyId === property.id).length} rent entries, ${data.bills.filter((row) => row.propertyId === property.id).length} bills and ${data.issues.filter((row) => row.propertyId === property.id).length} issues.</p></section></div>
    </div>`;
}

function ordinal(number) {
  const mod100 = number % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' })[number % 10] || 'th';
}

function profileDocuments(property, data) {
  const docs = data.documents.filter((document) => document.propertyId === property.id)
    .map((document) => ({ ...document, currentStatus: getDocumentStatus(document, data.config) }))
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const types = new Map(data.documentTypes.map((type) => [type.id, type.name]));
  return simpleProfileTable('Documents', docs, [
    ['Document', (item) => escapeHtml(types.get(item.type) || item.type)],
    ['File', (item) => `<span class="text-secondary">${escapeHtml(item.fileName)}</span>`],
    ['Issue date', (item) => formatDate(item.issueDate)],
    ['Expiry date', (item) => formatDate(item.expiryDate)],
    ['Status', (item) => statusBadge(item.currentStatus)]
  ], 'No documents are linked to this property.');
}

function profileRent(property, data) {
  const rows = data.rentSchedule.filter((rent) => rent.propertyId === property.id)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const tenants = new Map(data.tenants.map((tenant) => [tenant.id, tenant.name]));
  return simpleProfileTable('Rent history', rows, [
    ['Tenant', (item) => escapeHtml(tenants.get(item.tenantId) || 'Former tenant')],
    ['Due date', (item) => formatDate(item.dueDate)],
    ['Amount', (item) => formatCurrency(item.amount, data.config)],
    ['Paid', (item) => item.paidAmount ? formatCurrency(item.paidAmount, data.config) : '—'],
    ['Status', (item) => statusBadge(getRentStatus(item, data.config))]
  ], 'No rent schedule entries are available.');
}

function profileBills(property, data) {
  const rows = data.bills.filter((bill) => bill.propertyId === property.id)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  return simpleProfileTable('Bills', rows, [
    ['Bill', (item) => `${escapeHtml(item.type)} · ${escapeHtml(item.supplier)}`],
    ['Due date', (item) => formatDate(item.dueDate)],
    ['Amount', (item) => formatCurrency(item.amount, data.config)],
    ['Paid by', (item) => escapeHtml(item.paidBy)],
    ['Status', (item) => statusBadge(getBillStatus(item, data.config))]
  ], 'No bills are linked to this property.');
}

function profileIssues(property, data) {
  const rows = data.issues.filter((issue) => issue.propertyId === property.id)
    .sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  return simpleProfileTable('Issues', rows, [
    ['Issue', (item) => `<strong>${escapeHtml(item.title)}</strong><div class="small text-secondary">${escapeHtml(item.description)}</div>`],
    ['Priority', (item) => statusBadge(item.priority)],
    ['Status', (item) => statusBadge(item.status)],
    ['Reported', (item) => formatDate(item.createdOn)]
  ], 'No issues have been reported for this property.');
}

function profileFinance(property, data) {
  const ledger = data.ledger.filter((entry) => entry.propertyId === property.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const accounts = new Map(data.accounts.map((account) => [account.id, account]));
  const income = ledger.reduce((sum, entry) => sum + (accounts.get(entry.accountId)?.type === 'Income' ? entry.credit : 0), 0);
  const expenses = ledger.reduce((sum, entry) => sum + (accounts.get(entry.accountId)?.type === 'Expense' ? entry.debit : 0), 0);
  return `<div class="row g-3 mb-3">
    <div class="col-md-4"><div class="stat-card"><div class="stat-label">Recorded income</div><div class="stat-value text-success">${formatCurrency(income, data.config)}</div></div></div>
    <div class="col-md-4"><div class="stat-card"><div class="stat-label">Recorded expenses</div><div class="stat-value text-danger">${formatCurrency(expenses, data.config)}</div></div></div>
    <div class="col-md-4"><div class="stat-card"><div class="stat-label">Net recorded</div><div class="stat-value">${formatCurrency(income - expenses, data.config)}</div></div></div>
  </div>${simpleProfileTable('Finance ledger', ledger, [
    ['Date', (item) => formatDate(item.date)],
    ['Account', (item) => escapeHtml(accounts.get(item.accountId)?.name || 'Account')],
    ['Description', (item) => escapeHtml(item.description)],
    ['Debit', (item) => item.debit ? formatCurrency(item.debit, data.config) : '—'],
    ['Credit', (item) => item.credit ? formatCurrency(item.credit, data.config) : '—']
  ], 'No ledger entries are available for this property.')}`;
}

function profileNotes(property, data, role) {
  return `<section class="panel-card"><h2 class="h6 fw-bold">Property notes</h2>
    ${role === 'accountant' ? `<p class="mb-0">${escapeHtml(property.notes || 'No notes recorded.')}</p>` : `<form id="propertyNotesForm"><label class="form-label small text-secondary" for="propertyNotesField">Private management notes</label><textarea class="form-control mb-3" id="propertyNotesField" name="notes" rows="6" maxlength="1000">${escapeHtml(property.notes || '')}</textarea><button class="btn btn-forest btn-sm" type="submit">Save notes</button></form>`}
  </section>`;
}

function simpleProfileTable(title, rows, columns, emptyMessage) {
  if (!rows.length) return `<div class="panel-card"><h2 class="h6 fw-bold">${title}</h2><div class="empty-state"><i class="bi bi-inbox"></i>${emptyMessage}</div></div>`;
  return `<section class="panel-card"><h2 class="h6 fw-bold mb-3">${title}</h2><div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr>${columns.map(([label]) => `<th>${label}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map(([, render]) => `<td>${render(row)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

function profileContent(tab, property, data, role) {
  const tenant = propertyTenant(property.id, data);
  const linked = propertyLinkedCount(property.id, data);
  switch (tab) {
    case 'tenant':
      return tenant
        ? `<section class="panel-card"><h2 class="h6 fw-bold">Current tenant</h2><div class="d-flex align-items-center gap-3"><span class="user-avatar">${escapeHtml(tenant.name.split(' ').map((part) => part[0]).join('').slice(0, 2))}</span><div><a class="fw-semibold text-decoration-none" href="#/tenants/${encodeURIComponent(tenant.id)}">${escapeHtml(tenant.name)}</a><div class="small text-secondary">${escapeHtml(tenant.email)} · ${escapeHtml(tenant.phone)}</div></div>${statusBadge(tenant.status)}</div><hr><div class="row small"><div class="col-md-4"><span class="text-secondary">Tenancy</span><div>${formatDate(tenant.tenancyStart)} – ${formatDate(tenant.tenancyEnd)}</div></div><div class="col-md-4"><span class="text-secondary">Rent due</span><div>${tenant.rentDueDay}${ordinal(tenant.rentDueDay)} of each month</div></div><div class="col-md-4"><span class="text-secondary">Monthly rent</span><div>${formatCurrency(property.monthlyRent, data.config)}</div></div></div></section>`
        : '<div class="panel-card"><div class="empty-state"><i class="bi bi-person-plus"></i>No active tenant is assigned to this property.</div></div>';
    case 'documents': return profileDocuments(property, data);
    case 'rent': return profileRent(property, data);
    case 'bills': return profileBills(property, data);
    case 'issues': return profileIssues(property, data);
    case 'finance': return profileFinance(property, data);
    case 'notes': return profileNotes(property, data, role);
    default: return profileOverview(property, data, tenant, linked);
  }
}

function propertyProfileTemplate(property, data, role, tab) {
  const tenant = propertyTenant(property.id, data);
  const safeTab = PROFILE_TABS.some(([key]) => key === tab) ? tab : 'overview';
  return `
    <div class="page-header">
      <div><a href="#/properties" class="small text-decoration-none"><i class="bi bi-arrow-left me-1"></i>Properties</a><p class="page-eyebrow mt-3">${escapeHtml(property.address)} · ${escapeHtml(property.postcode)}</p><h1 class="page-title">${escapeHtml(property.name)}</h1><p class="page-subtitle">${escapeHtml(property.type)} · ${property.bedrooms} bedrooms · ${formatCurrency(property.monthlyRent, data.config)} pcm</p></div>
      <div class="d-flex align-items-center gap-2">${statusBadge(property.status)}${role !== 'accountant' ? `<button class="btn btn-light border" data-action="edit-property" data-id="${escapeHtml(property.id)}"><i class="bi bi-pencil me-1"></i>Edit</button><button class="btn btn-outline-danger" data-action="delete-property" data-id="${escapeHtml(property.id)}" ${propertyLinkedCount(property.id, data) ? 'disabled title="Remove linked records before deleting this property."' : ''}><i class="bi bi-trash me-1"></i>Delete</button>` : ''}</div>
    </div>
    <div class="d-flex flex-wrap gap-2 mb-3">
      <span class="badge bg-white text-secondary border"><i class="bi bi-person me-1"></i>${tenant ? escapeHtml(tenant.name) : 'No active tenant'}</span>
      <span class="badge bg-white text-secondary border"><i class="bi bi-shield-check me-1"></i>EPC ${escapeHtml(property.epcRating)}</span>
      <span class="badge bg-white text-secondary border"><i class="bi bi-key me-1"></i>Deposit ${escapeHtml(property.depositScheme)}</span>
    </div>
    <ul class="nav nav-tabs mb-3 property-profile-tabs" aria-label="Property profile sections">${PROFILE_TABS.map(([key, label, icon]) => `<li class="nav-item">${tabLink(property.id, key, label, icon, safeTab === key)}</li>`).join('')}</ul>
    <div id="propertyProfilePanel">${profileContent(safeTab, property, data, role)}</div>
    ${propertyForm(property, role)}`;
}

function bindPropertyModal(container, context, property) {
  const modalElement = container.querySelector('#propertyModal');
  const form = container.querySelector('#propertyForm');
  if (!modalElement || !form) return;
  const modal = window.bootstrap.Modal.getOrCreateInstance(modalElement);
  if (form.dataset.bound) return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (context.role === 'accountant' || !form.reportValidity()) return;
    const values = propertyFormValues(form);
    const properties = context.data.properties;
    const editingProperty = properties.find((item) => item.id === (form.dataset.editingProperty || property?.id));
    const propertyId = editingProperty?.id || id('p');
    if (values.status === 'vacant' && context.data.tenants.some((tenant) => tenant.propertyId === propertyId && tenant.status === 'active')) {
      context.toast('An active tenant is assigned to this property; end or move the tenancy first.', 'error');
      return;
    }
    if (editingProperty) {
      Object.assign(editingProperty, values);
      context.data.properties = properties;
    } else {
      properties.push({ id: propertyId, ...values });
    }
    const saved = properties.find((item) => item.id === propertyId);
    try {
      context.save('properties', properties);
      context.save('auditLog', [...context.data.auditLog, auditRow(context.data, context.role, editingProperty ? 'Updated' : 'Created', 'Property', `${saved.name} property record ${editingProperty ? 'updated' : 'created'}.`)]);
      modal.hide();
      context.refresh();
      context.toast(`${saved.name} ${editingProperty ? 'updated' : 'added'}`);
    } catch (error) {
      context.toast(`Could not save property: ${error.message}`, 'error');
    }
  });
}

export function renderPropertyList(container, context) {
  container.innerHTML = propertyListTemplate(context.data, context.role);
  const filters = container.querySelector('#propertyFilter');
  const status = container.querySelector('#propertyStatusFilter');
  container.dataset.view = 'table';
  const updateResults = () => applyPropertyFilters(container, context.data, context.role);
  filters.addEventListener('input', updateResults);
  status.addEventListener('change', updateResults);
  container.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
    container.dataset.view = button.dataset.view;
    container.querySelectorAll('[data-view]').forEach((item) => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    updateResults();
  }));
  updateResults();
  bindPropertyModal(container, context, null);
  container.onclick = (event) => handlePropertyActions(event, container, context);
}

export function renderPropertyProfile(container, context, propertyId, tab = 'overview') {
  const property = context.data.properties.find((item) => item.id === propertyId);
  if (!property) {
    container.innerHTML = '<div class="placeholder-page"><h1 class="h3">Property not found</h1><a class="btn btn-forest btn-sm" href="#/properties">Back to properties</a></div>';
    return;
  }
  container.innerHTML = propertyProfileTemplate(property, context.data, context.role, tab);
  bindPropertyModal(container, context, property);
  container.onclick = (event) => handlePropertyActions(event, container, context);
  container.querySelector('#propertyNotesForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (context.role === 'accountant') return;
    const notes = new FormData(event.currentTarget).get('notes').trim();
    property.notes = notes;
    try {
      context.save('properties', context.data.properties);
      context.save('auditLog', [...context.data.auditLog, auditRow(context.data, context.role, 'Updated', 'Property notes', `Notes updated for ${property.name}.`)]);
      context.toast('Property notes saved');
    } catch (error) {
      context.toast(`Could not save notes: ${error.message}`, 'error');
    }
  });
}

function handlePropertyActions(event, container, context) {
  const button = event.target.closest('[data-action]');
  if (!button || context.role === 'accountant') return;
  const property = context.data.properties.find((item) => item.id === button.dataset.id);
  if (button.dataset.action === 'add-property') {
    const form = container.querySelector('#propertyForm');
    form.reset();
    delete form.dataset.editingProperty;
    form.querySelector('[name="status"]').value = 'vacant';
    window.bootstrap.Modal.getOrCreateInstance(container.querySelector('#propertyModal')).show();
  }
  if (button.dataset.action === 'edit-property' && property) {
    const route = window.location.hash.match(/^#\/properties\/([^?]+)/);
    const propertyContainer = route ? document.querySelector('#mainContent') : container;
    const form = propertyContainer.querySelector('#propertyForm');
    if (!form) return;
    form.dataset.editingProperty = property.id;
    for (const [key, value] of Object.entries(property)) {
      const field = form.elements.namedItem(key);
      if (field) field.value = value ?? '';
    }
    window.bootstrap.Modal.getOrCreateInstance(propertyContainer.querySelector('#propertyModal')).show();
  }
  if (button.dataset.action === 'delete-property' && property) {
    if (propertyLinkedCount(property.id, context.data)) {
      context.toast('This property still has linked records and cannot be deleted.', 'error');
      return;
    }
    if (!window.confirm(`Delete ${property.name}? This cannot be undone.`)) return;
    context.data.properties = context.data.properties.filter((item) => item.id !== property.id);
    try {
      context.save('properties', context.data.properties);
      context.save('auditLog', [...context.data.auditLog, auditRow(context.data, context.role, 'Deleted', 'Property', `${property.name} property record deleted.`)]);
      window.location.hash = '#/properties';
      context.toast(`${property.name} deleted`);
    } catch (error) {
      context.toast(`Could not delete property: ${error.message}`, 'error');
    }
  }
}
