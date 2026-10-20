import { formatCurrency } from '../../data/helpers/currency.js';
import { formatDate } from '../../data/helpers/date.js';
import { getDocumentStatus, getRentStatus } from '../../data/helpers/status.js';

const TENANT_STATUSES = ['active', 'pending', 'ended'];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function badge(status) {
  const colour = { active: 'success', pending: 'warning', ended: 'secondary', paid: 'success', overdue: 'danger', partial: 'warning', upcoming: 'primary' }[status] || 'secondary';
  return `<span class="badge text-bg-${colour} bg-opacity-10 text-${colour} border border-${colour} border-opacity-10">${escapeHtml(status)}</span>`;
}

function auditRow(data, role, action, detail) {
  return {
    id: makeId('audit'),
    date: `${data.config.demoToday}T12:00:00`,
    userName: role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
    action,
    entity: 'Tenant',
    detail
  };
}

function tenantForm(tenant, data, role) {
  const editing = Boolean(tenant);
  return `
    <div class="modal fade" id="tenantModal" tabindex="-1" aria-labelledby="tenantModalTitle" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <form class="modal-content" id="tenantForm">
          <div class="modal-header"><h2 class="modal-title fs-5" id="tenantModalTitle">${editing ? 'Edit tenant' : 'Add tenant'}</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
          <div class="modal-body"><div class="row g-3">
            <div class="col-md-6"><label class="form-label" for="tenantName">Full name</label><input class="form-control" id="tenantName" name="name" required maxlength="100" value="${escapeHtml(tenant?.name)}"></div>
            <div class="col-md-6"><label class="form-label" for="tenantEmail">Email</label><input class="form-control" id="tenantEmail" name="email" type="email" required maxlength="120" value="${escapeHtml(tenant?.email)}"></div>
            <div class="col-md-6"><label class="form-label" for="tenantPhone">UK phone</label><input class="form-control" id="tenantPhone" name="phone" type="tel" required maxlength="25" pattern=".{9,25}" value="${escapeHtml(tenant?.phone)}"></div>
            <div class="col-md-6"><label class="form-label" for="tenantProperty">Property</label><select class="form-select" id="tenantProperty" name="propertyId" required><option value="">Choose property</option>${data.properties.map((property) => { const occupied = data.tenants.some((item) => item.id !== tenant?.id && item.propertyId === property.id && item.status === 'active'); return `<option value="${escapeHtml(property.id)}" ${tenant?.propertyId === property.id ? 'selected' : ''}>${escapeHtml(property.name)} · ${escapeHtml(property.postcode)}${occupied ? ' · currently occupied' : ' · vacant'}</option>`; }).join('')}</select></div>
            <div class="col-md-4"><label class="form-label" for="tenancyStart">Tenancy start</label><input class="form-control" id="tenancyStart" name="tenancyStart" type="date" required value="${escapeHtml(tenant?.tenancyStart || data.config.demoToday)}"></div>
            <div class="col-md-4"><label class="form-label" for="tenancyEnd">Tenancy end</label><input class="form-control" id="tenancyEnd" name="tenancyEnd" type="date" required value="${escapeHtml(tenant?.tenancyEnd || '')}"></div>
            <div class="col-md-2"><label class="form-label" for="rentDueDay">Rent day</label><input class="form-control" id="rentDueDay" name="rentDueDay" type="number" min="1" max="28" required value="${tenant?.rentDueDay ?? 1}"></div>
            <div class="col-md-2"><label class="form-label" for="tenantStatus">Status</label><select class="form-select" id="tenantStatus" name="status">${TENANT_STATUSES.map((status) => `<option value="${status}" ${tenant?.status === status || (!tenant && status === 'active') ? 'selected' : ''}>${status[0].toUpperCase()}${status.slice(1)}</option>`).join('')}</select></div>
          </div><p class="small text-secondary mt-3 mb-0">New tenants receive a demo profile. Real account login requires the live system.</p></div>
          <div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-forest">${editing ? 'Save changes' : 'Add tenant'}</button></div>
        </form>
      </div>
    </div>`;
}

function tenantRows(data, tenants, canEdit) {
  if (!tenants.length) return '<div class="empty-state"><i class="bi bi-people"></i>No tenants match these filters.</div>';
  const properties = new Map(data.properties.map((property) => [property.id, property]));
  return `<div class="table-responsive"><table class="table align-middle mb-0">
    <thead><tr><th>Tenant</th><th>Property</th><th>Tenancy</th><th>Status</th><th class="text-end">Monthly rent</th><th><span class="visually-hidden">Actions</span></th></tr></thead>
    <tbody>${tenants.map((tenant) => {
      const property = properties.get(tenant.propertyId);
      return `<tr>
        <td><a class="fw-semibold text-decoration-none" href="#/tenants/${encodeURIComponent(tenant.id)}">${escapeHtml(tenant.name)}</a><div class="small text-secondary">${escapeHtml(tenant.email)} · ${escapeHtml(tenant.phone)}</div></td>
        <td>${property ? `<a class="text-decoration-none" href="#/properties/${encodeURIComponent(property.id)}">${escapeHtml(property.name)}</a><div class="small text-secondary">${escapeHtml(property.postcode)}</div>` : '<span class="text-secondary">Unassigned</span>'}</td>
        <td>${formatDate(tenant.tenancyStart)}<div class="small text-secondary">to ${formatDate(tenant.tenancyEnd)} · due ${tenant.rentDueDay}${ordinal(tenant.rentDueDay)}</div></td>
        <td>${badge(tenant.status)}</td><td class="text-end fw-semibold">${property ? formatCurrency(property.monthlyRent, data.config) : '—'}</td>
        <td class="text-end text-nowrap"><a class="btn btn-sm btn-light" href="#/tenants/${encodeURIComponent(tenant.id)}" aria-label="View ${escapeHtml(tenant.name)}">View</a>${canEdit ? ` <button class="btn btn-sm btn-light" data-action="edit-tenant" data-id="${escapeHtml(tenant.id)}" aria-label="Edit ${escapeHtml(tenant.name)}"><i class="bi bi-pencil"></i></button>` : ''}</td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

function ordinal(number) {
  const mod100 = number % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' })[number % 10] || 'th';
}

export function renderTenantList(container, context) {
  const canEdit = context.role !== 'accountant';
  let editingTenantId = null;
  const active = context.data.tenants.filter((tenant) => tenant.status === 'active').length;
  container.innerHTML = `
    <div class="page-header"><div><p class="page-eyebrow">Portfolio</p><h1 class="page-title">Tenants</h1><p class="page-subtitle">Tenant records, current tenancies and rent details.</p></div>${canEdit ? '<button class="btn btn-forest" data-action="add-tenant"><i class="bi bi-plus-lg me-1"></i>Add tenant</button>' : '<span class="small text-secondary">Read-only access</span>'}</div>
    <div class="row g-3 mb-3">
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">All tenants</div><div class="stat-value">${context.data.tenants.length}</div><div class="stat-hint">Including historical records</div></div></div>
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Active</div><div class="stat-value">${active}</div><div class="stat-hint">Current tenancies</div></div></div>
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value">${context.data.tenants.filter((tenant) => tenant.status === 'pending').length}</div><div class="stat-hint">Awaiting tenancy start</div></div></div>
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Ended</div><div class="stat-value">${context.data.tenants.filter((tenant) => tenant.status === 'ended').length}</div><div class="stat-hint">Former tenants</div></div></div>
    </div>
    <section class="panel-card">
      <div class="d-flex flex-wrap gap-2 mb-3">
        <div class="input-group input-group-sm" style="width:min(100%, 340px)"><span class="input-group-text bg-white"><i class="bi bi-search"></i></span><input class="form-control" id="tenantSearch" type="search" placeholder="Search tenant, email or property" aria-label="Search tenants"></div>
        <select class="form-select form-select-sm" id="tenantStatusFilter" aria-label="Filter tenants by status" style="width:145px"><option value="">All statuses</option>${TENANT_STATUSES.map((status) => `<option value="${status}">${status[0].toUpperCase()}${status.slice(1)}</option>`).join('')}</select>
      </div>
      <div id="tenantResults"></div>
    </section>
    ${canEdit ? tenantForm(null, context.data, context.role) : ''}`;

  const update = () => {
    const query = container.querySelector('#tenantSearch').value.trim().toLowerCase();
    const status = container.querySelector('#tenantStatusFilter').value;
    const properties = new Map(context.data.properties.map((property) => [property.id, property.name]));
    const filtered = context.data.tenants.filter((tenant) => {
      const searchable = `${tenant.name} ${tenant.email} ${tenant.phone} ${properties.get(tenant.propertyId) || ''}`.toLowerCase();
      return searchable.includes(query) && (!status || tenant.status === status);
    });
    container.querySelector('#tenantResults').innerHTML = tenantRows(context.data, filtered, canEdit);
  };
  container.querySelector('#tenantSearch').addEventListener('input', update);
  container.querySelector('#tenantStatusFilter').addEventListener('change', update);
  update();
  if (!canEdit) return;

  container.onclick = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'add-tenant') {
      editingTenantId = null;
      const form = container.querySelector('#tenantForm');
      form.reset();
      form.elements.namedItem('tenancyStart').value = context.data.config.demoToday;
      window.bootstrap.Modal.getOrCreateInstance(container.querySelector('#tenantModal')).show();
    } else if (button.dataset.action === 'edit-tenant') {
      const tenant = context.data.tenants.find((item) => item.id === button.dataset.id);
      if (!tenant) return;
      editingTenantId = tenant.id;
      const form = container.querySelector('#tenantForm');
      for (const [key, value] of Object.entries(tenant)) {
        const field = form.elements.namedItem(key);
        if (field) field.value = value;
      }
      window.bootstrap.Modal.getOrCreateInstance(container.querySelector('#tenantModal')).show();
    }
  };
  container.querySelector('#tenantForm').addEventListener('submit', (event) => {
    const tenant = context.data.tenants.find((item) => item.id === editingTenantId);
    saveTenantForm(event, container, context, tenant || null);
  });
}

function saveTenantForm(event, container, context, existingTenant) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const start = values.get('tenancyStart');
  const end = values.get('tenancyEnd');
  const phone = values.get('phone').trim();
  if (!/^[+0-9 ()-]{9,25}$/.test(phone)) {
    form.elements.namedItem('phone').setCustomValidity('Enter a valid UK phone number using numbers, spaces or hyphens.');
    form.reportValidity();
    form.elements.namedItem('phone').setCustomValidity('');
    return;
  }
  if (end < start) {
    form.elements.namedItem('tenancyEnd').setCustomValidity('Tenancy end must be on or after the start date.');
    form.reportValidity();
    form.elements.namedItem('tenancyEnd').setCustomValidity('');
    return;
  }

  const previousPropertyId = existingTenant?.propertyId;
  const selectedProperty = context.data.properties.find((property) => property.id === values.get('propertyId'));
  const tenantValues = {
    propertyId: selectedProperty.id,
    name: values.get('name').trim(),
    email: values.get('email').trim(),
    phone,
    tenancyStart: start,
    tenancyEnd: end,
    rentDueDay: Number(values.get('rentDueDay')),
    status: values.get('status')
  };
  const occupiedByAnotherTenant = tenantValues.status === 'active' && context.data.tenants.some((tenant) =>
    tenant.id !== existingTenant?.id && tenant.propertyId === selectedProperty.id && tenant.status === 'active'
  );
  if (occupiedByAnotherTenant) {
    form.elements.namedItem('propertyId').setCustomValidity('Another active tenant is already assigned to this property.');
    form.reportValidity();
    form.elements.namedItem('propertyId').setCustomValidity('');
    return;
  }
  const users = context.data.users;
  let user;
  if (existingTenant) {
    existingTenant = context.data.tenants.find((tenant) => tenant.id === existingTenant.id);
    Object.assign(existingTenant, tenantValues);
    user = users.find((item) => item.id === existingTenant.userId);
    if (user) Object.assign(user, { name: tenantValues.name, email: tenantValues.email, phone: tenantValues.phone });
  } else {
    user = { id: makeId('user'), name: tenantValues.name, email: tenantValues.email, phone: tenantValues.phone, role: 'tenant', status: 'active' };
    users.push(user);
    existingTenant = { id: makeId('t'), userId: user.id, ...tenantValues };
    context.data.tenants.push(existingTenant);
  }

  const previousProperty = context.data.properties.find((property) => property.id === previousPropertyId);
  if (previousProperty && previousPropertyId !== selectedProperty.id && !context.data.tenants.some((tenant) => tenant.id !== existingTenant.id && tenant.propertyId === previousPropertyId && tenant.status === 'active')) {
    previousProperty.status = 'vacant';
  }
  if (existingTenant.status === 'active') selectedProperty.status = 'occupied';
  else if (!context.data.tenants.some((tenant) => tenant.id !== existingTenant.id && tenant.propertyId === selectedProperty.id && tenant.status === 'active')) selectedProperty.status = 'vacant';

  const newTenant = !previousPropertyId;
  try {
    context.save('users', users);
    context.save('tenants', context.data.tenants);
    context.save('properties', context.data.properties);
    if (newTenant) {
      const demoToday = new Date(`${context.data.config.demoToday}T00:00:00`);
      const tenancyStart = new Date(`${tenantValues.tenancyStart}T00:00:00`);
      const referenceDate = tenancyStart > demoToday ? tenancyStart : demoToday;
      const dueMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + (tenantValues.rentDueDay < referenceDate.getDate() ? 1 : 0), 1);
      const dueDate = `${dueMonth.getFullYear()}-${String(dueMonth.getMonth() + 1).padStart(2, '0')}-${String(tenantValues.rentDueDay).padStart(2, '0')}`;
      context.data.rentSchedule.push({
        id: makeId('rent'),
        tenantId: existingTenant.id,
        propertyId: selectedProperty.id,
        dueDate,
        amount: selectedProperty.monthlyRent,
        status: 'upcoming',
        paidAmount: 0,
        paidOn: null,
        method: null
      });
      context.save('rentSchedule', context.data.rentSchedule);
    }
    const notification = {
      id: makeId('notification'),
      userId: user.id,
      audience: 'tenant',
      title: newTenant ? 'Welcome to Landlord Desk' : 'Tenancy details updated',
      body: newTenant
        ? `Your tenancy profile for ${selectedProperty.name} has been set up.`
        : `Your tenancy details for ${selectedProperty.name} have been updated.`,
      type: 'system',
      createdOn: context.data.config.demoToday,
      read: false
    };
    context.data.notifications.push(notification);
    context.save('notifications', context.data.notifications);
    context.save('auditLog', [...context.data.auditLog, auditRow(context.data, context.role, newTenant ? 'Created' : 'Updated', `${existingTenant.name} tenant record ${newTenant ? 'created' : 'updated'}.`)]);
    window.bootstrap.Modal.getOrCreateInstance(container.querySelector('#tenantModal')).hide();
    context.refresh();
    context.toast(`${existingTenant.name} ${newTenant ? 'added' : 'updated'}`);
  } catch (error) {
    context.toast(`Could not save tenant: ${error.message}`, 'error');
  }
}

function tenantProfileTemplate(tenant, data, role) {
  const property = data.properties.find((item) => item.id === tenant.propertyId);
  const payments = data.payments.filter((payment) => payment.tenantId === tenant.id).sort((a, b) => b.date.localeCompare(a.date));
  const schedule = data.rentSchedule.filter((item) => item.tenantId === tenant.id).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const docs = data.documents.filter((document) => document.tenantId === tenant.id || (document.propertyId === tenant.propertyId && !document.tenantId));
  const documentTypes = new Map(data.documentTypes.map((type) => [type.id, type.name]));
  const statuses = schedule.slice(0, 5).map((item) => `${formatDate(item.dueDate)} ${badge(getRentStatus(item, data.config))}`).join(' · ');
  return `
    <div class="page-header"><div><a href="#/tenants" class="small text-decoration-none"><i class="bi bi-arrow-left me-1"></i>Tenants</a><p class="page-eyebrow mt-3">${property ? escapeHtml(property.name) : 'Unassigned property'} · ${escapeHtml(tenant.email)}</p><h1 class="page-title">${escapeHtml(tenant.name)}</h1><p class="page-subtitle">${escapeHtml(tenant.phone)} · ${formatDate(tenant.tenancyStart)} to ${formatDate(tenant.tenancyEnd)}</p></div><div class="d-flex align-items-center gap-2">${badge(tenant.status)}${role !== 'accountant' ? `<button class="btn btn-light border" data-action="edit-tenant" data-id="${escapeHtml(tenant.id)}"><i class="bi bi-pencil me-1"></i>Edit tenant</button>` : ''}</div></div>
    <div class="row g-3 mb-3">
      <div class="col-md-4"><section class="stat-card h-100"><div class="stat-label">Property</div><div class="h5 fw-bold mt-2">${property ? `<a class="text-decoration-none" href="#/properties/${encodeURIComponent(property.id)}">${escapeHtml(property.name)}</a>` : 'Unassigned'}</div><div class="stat-hint">${property ? `${escapeHtml(property.address)}, ${escapeHtml(property.postcode)}` : 'No property assigned'}</div></section></div>
      <div class="col-md-4"><section class="stat-card h-100"><div class="stat-label">Monthly rent</div><div class="stat-value">${property ? formatCurrency(property.monthlyRent, data.config) : '—'}</div><div class="stat-hint">Due on the ${tenant.rentDueDay}${ordinal(tenant.rentDueDay)} of each month</div></section></div>
      <div class="col-md-4"><section class="stat-card h-100"><div class="stat-label">Payments on record</div><div class="stat-value">${payments.length}</div><div class="stat-hint">${schedule.length} rent schedule entries · ${docs.length} related documents</div></section></div>
    </div>
    <div class="row g-3">
      <div class="col-xl-7"><section class="panel-card"><h2 class="h6 fw-bold mb-3">Payment history</h2>${payments.length ? `<div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Payment date</th><th>Reference</th><th>Method</th><th class="text-end">Amount</th></tr></thead><tbody>${payments.map((payment) => `<tr><td>${formatDate(payment.date)}</td><td>${escapeHtml(payment.reference)}</td><td>${escapeHtml(payment.method)}</td><td class="text-end fw-semibold">${formatCurrency(payment.amount, data.config)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><i class="bi bi-cash"></i>No payments recorded yet.</div>'}</section></div>
      <div class="col-xl-5"><section class="panel-card mb-3"><h2 class="h6 fw-bold mb-3">Tenancy details</h2><dl class="row small mb-0"><dt class="col-5 text-secondary">Email</dt><dd class="col-7">${escapeHtml(tenant.email)}</dd><dt class="col-5 text-secondary">Phone</dt><dd class="col-7">${escapeHtml(tenant.phone)}</dd><dt class="col-5 text-secondary">Tenancy dates</dt><dd class="col-7">${formatDate(tenant.tenancyStart)} – ${formatDate(tenant.tenancyEnd)}</dd><dt class="col-5 text-secondary">Rent schedule</dt><dd class="col-7">${statuses || 'No schedule'}</dd></dl></section>
      <section class="panel-card"><h2 class="h6 fw-bold mb-3">Documents</h2>${docs.length ? `<ul class="list-unstyled mb-0 small">${docs.map((document) => `<li class="d-flex justify-content-between gap-2 py-2 border-bottom"><span>${escapeHtml(documentTypes.get(document.type) || document.fileName)}<small class="d-block text-secondary">${formatDate(document.expiryDate)}</small></span>${badge(getDocumentStatus(document, data.config))}</li>`).join('')}</ul>` : '<div class="empty-state"><i class="bi bi-file-earmark"></i>No documents linked.</div>'}</section></div>
    </div>
    ${role !== 'accountant' ? tenantForm(tenant, data, role) : ''}`;
}

export function renderTenantProfile(container, context, tenantId) {
  const tenant = context.data.tenants.find((item) => item.id === tenantId);
  if (!tenant) {
    container.innerHTML = '<div class="placeholder-page"><h1 class="h3">Tenant not found</h1><a class="btn btn-forest btn-sm" href="#/tenants">Back to tenants</a></div>';
    return;
  }
  container.innerHTML = tenantProfileTemplate(tenant, context.data, context.role);
  if (context.role === 'accountant') return;
  const form = container.querySelector('#tenantForm');
  if (form) {
    form.addEventListener('submit', (event) => saveTenantForm(event, container, context, tenant));
    container.querySelector('[data-action="edit-tenant"]')?.addEventListener('click', () => {
      for (const [key, value] of Object.entries(tenant)) {
        const field = form.elements.namedItem(key);
        if (field) field.value = value;
      }
      window.bootstrap.Modal.getOrCreateInstance(container.querySelector('#tenantModal')).show();
    });
  }
}
