import { formatCurrency } from '../../data/helpers/currency.js';
import { formatDate, parseISODate } from '../../data/helpers/date.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function createAudit(data, context, action, detail) {
  return {
    id: makeId('audit'),
    date: `${data.config.demoToday}T12:00:00`,
    userName: context.role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
    action,
    entity: 'Tenant request',
    detail
  };
}

function createNotification(data, userId, title, body, audience = 'tenant') {
  return {
    id: makeId('notification'),
    userId,
    audience,
    title,
    body,
    type: 'system',
    createdOn: data.config.demoToday,
    read: false
  };
}

function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function endOfTenancy(start) {
  const date = parseISODate(start);
  date.setFullYear(date.getFullYear() + 1);
  date.setDate(date.getDate() - 1);
  return toISODate(date);
}

function getNextRentDate(start, rentDueDay) {
  const demoToday = parseISODate(start);
  const nextDueDate = new Date(demoToday.getFullYear(), demoToday.getMonth(), rentDueDay);
  if (nextDueDate < demoToday) nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  return toISODate(nextDueDate);
}

function requestCard(request, data, canManage) {
  const property = data.properties.find((item) => item.id === request.propertyId);
  return `
    <article class="request-card" data-request-search="${escapeHtml(`${request.name} ${request.email} ${property?.name || ''}`.toLowerCase())}">
      <div class="d-flex flex-wrap justify-content-between gap-2 align-items-start">
        <div><h2 class="h6 fw-bold mb-1">${escapeHtml(request.name)}</h2><div class="small text-secondary">${escapeHtml(request.email)} · ${escapeHtml(request.phone)}</div></div>
        <span class="badge text-bg-warning bg-opacity-10 text-warning border border-warning border-opacity-10">Pending</span>
      </div>
      <div class="request-details mt-3">
        <div><span>Property</span><strong>${escapeHtml(property?.name || 'Property unavailable')}</strong></div>
        <div><span>Requested</span><strong>${formatDate(request.requestedOn)}</strong></div>
      </div>
      <p class="small mb-0 mt-3">${escapeHtml(request.message || 'No message provided.')}</p>
      ${canManage ? `<div class="d-flex gap-2 mt-3"><button class="btn btn-sm btn-forest" data-action="approve-request" data-id="${escapeHtml(request.id)}"><i class="bi bi-check2 me-1"></i>Approve</button><button class="btn btn-sm btn-outline-danger" data-action="reject-request" data-id="${escapeHtml(request.id)}"><i class="bi bi-x-lg me-1"></i>Reject</button></div>` : '<p class="small text-secondary mt-3 mb-0">Read-only access</p>'}
    </article>`;
}

function approvalModal(request, property, demoToday) {
  return `
    <div class="modal fade" id="approveRequestModal" tabindex="-1" aria-labelledby="approveRequestTitle" aria-hidden="true">
      <div class="modal-dialog">
        <form class="modal-content" id="approveRequestForm">
          <div class="modal-header"><h2 class="modal-title fs-5" id="approveRequestTitle">Approve tenant request</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
          <div class="modal-body">
            <p class="text-secondary small">Create a tenant profile and initial rent schedule for <strong>${escapeHtml(request.name)}</strong> at <strong>${escapeHtml(property?.name || 'the selected property')}</strong>.</p>
            <input type="hidden" name="requestId" value="${escapeHtml(request.id)}">
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label" for="requestStart">Tenancy starts</label><input class="form-control" id="requestStart" name="tenancyStart" type="date" value="${escapeHtml(demoToday)}" required></div>
              <div class="col-md-6"><label class="form-label" for="requestEnd">Tenancy ends</label><input class="form-control" id="requestEnd" name="tenancyEnd" type="date" value="${escapeHtml(endOfTenancy(demoToday))}" required></div>
              <div class="col-md-6"><label class="form-label" for="requestRentDay">Monthly rent due day</label><input class="form-control" id="requestRentDay" name="rentDueDay" type="number" min="1" max="28" value="1" required></div>
            </div>
            <p class="small text-secondary mt-3 mb-0">Property rent: ${property ? formatCurrency(property.monthlyRent, { currency: 'GBP' }) : 'Not available'}. If a tenancy is already active, the new tenant will be marked pending.</p>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-forest">Approve and create tenant</button></div>
        </form>
      </div>
    </div>`;
}

function updateCardCounts(container, requests) {
  const pending = requests.filter((request) => request.status === 'pending').length;
  container.querySelector('#pendingRequestCount').textContent = pending;
}

export function renderTenantRequests(container, context) {
  const canManage = context.role !== 'accountant';
  const pending = context.data.tenantRequests.filter((request) => request.status === 'pending');
  container.innerHTML = `
    <div class="page-header"><div><p class="page-eyebrow">Portfolio</p><h1 class="page-title">Tenant Requests</h1><p class="page-subtitle">Review enquiries and add approved tenants to your shared records.</p></div>${canManage ? '<span class="badge rounded-pill text-bg-warning bg-opacity-10 text-warning border border-warning border-opacity-10 px-3 py-2"><span id="pendingRequestCount"></span> pending</span>' : '<span class="small text-secondary">Read-only access</span>'}</div>
    <section class="panel-card">
      <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
        <div><h2 class="h6 fw-bold mb-1">Incoming requests</h2><p class="small text-secondary mb-0">Approving creates the tenant profile, user, initial rent schedule and notification.</p></div>
        <input class="form-control form-control-sm" type="search" id="requestSearch" placeholder="Search requests" aria-label="Search tenant requests" style="max-width:250px">
      </div>
      <div class="row g-3" id="requestResults"></div>
    </section>
    <div id="requestModalHost"></div>`;
  const results = container.querySelector('#requestResults');
  const renderResults = () => {
    const query = container.querySelector('#requestSearch').value.trim().toLowerCase();
    const requests = context.data.tenantRequests.filter((request) =>
      request.status === 'pending' &&
      `${request.name} ${request.email} ${request.message}`.toLowerCase().includes(query)
    );
    results.innerHTML = requests.length
      ? requests.map((request) => `<div class="col-xl-6">${requestCard(request, context.data, canManage)}</div>`).join('')
      : '<div class="col-12"><div class="empty-state"><i class="bi bi-inbox"></i>No tenant requests found.</div></div>';
    if (canManage) updateCardCounts(container, context.data.tenantRequests);
  };
  renderResults();
  container.querySelector('#requestSearch').addEventListener('input', renderResults);
  if (!canManage) return;

  container.onclick = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const request = context.data.tenantRequests.find((item) => item.id === button.dataset.id);
    if (!request || request.status !== 'pending') return;

    if (button.dataset.action === 'approve-request') {
      const property = context.data.properties.find((item) => item.id === request.propertyId);
      if (!property) {
        context.toast('The request references a property that no longer exists.', 'error');
        return;
      }
      const host = container.querySelector('#requestModalHost');
      host.innerHTML = approvalModal(request, property, context.data.config.demoToday);
      const form = host.querySelector('#approveRequestForm');
      form.addEventListener('submit', (submitEvent) => {
        submitEvent.preventDefault();
        if (!form.reportValidity()) return;
        approveRequest(request, property, new FormData(form), context, host, renderResults);
      }, { once: true });
      window.bootstrap.Modal.getOrCreateInstance(host.querySelector('#approveRequestModal')).show();
    }

    if (button.dataset.action === 'reject-request') {
      if (!window.confirm(`Reject ${request.name}’s request?`)) return;
      request.status = 'rejected';
      try {
        // These store writes become the corresponding API calls when the shared JSON overlay is replaced.
        context.save('tenantRequests', context.data.tenantRequests);
        context.save('auditLog', [...context.data.auditLog, createAudit(context.data, context, 'Rejected', `${request.name}’s request for ${context.data.properties.find((property) => property.id === request.propertyId)?.name || 'a property'} was rejected.`)]);
        renderResults();
        context.refresh();
        context.toast(`${request.name}’s request was rejected`);
      } catch (error) {
        context.toast(`Could not reject request: ${error.message}`, 'error');
      }
    }
  };
}

function approveRequest(request, property, fields, context, host, renderResults) {
  const existingOccupant = context.data.tenants.find((tenant) =>
    tenant.propertyId === property.id && tenant.status === 'active'
  );
  const start = fields.get('tenancyStart');
  const end = fields.get('tenancyEnd');
  if (end < start) {
    context.toast('Tenancy end must be on or after the start date.', 'error');
    return;
  }
  const rentDueDay = Number(fields.get('rentDueDay'));
  const userId = makeId('user');
  const tenantId = makeId('t');
  const user = {
    id: userId,
    name: request.name,
    email: request.email,
    role: 'tenant',
    phone: request.phone,
    status: 'active'
  };
  const tenantStatus = existingOccupant || start > context.data.config.demoToday ? 'pending' : 'active';
  const tenant = {
    id: tenantId,
    userId,
    propertyId: property.id,
    name: request.name,
    email: request.email,
    phone: request.phone,
    tenancyStart: start,
    tenancyEnd: end,
    rentDueDay,
    status: tenantStatus
  };
  const notification = createNotification(
    context.data,
    userId,
    'Your tenant profile is ready',
    `Your ${tenantStatus === 'pending' ? 'upcoming tenancy' : 'tenancy'} at ${property.name} has been set up.`
  );
  const adminNotification = createNotification(
    context.data,
    context.role === 'superadmin' ? 'u-admin' : 'u-manager',
    'Tenant request approved',
    `${request.name} was added for ${property.name}.`,
    'admin'
  );
  const rentDueDate = getNextRentDate(start, rentDueDay);
  const schedule = {
    id: makeId('rent'),
    tenantId,
    propertyId: property.id,
    dueDate: rentDueDate,
    amount: property.monthlyRent,
    status: 'upcoming',
    paidAmount: 0,
    paidOn: null,
    method: null
  };
  request.status = 'approved';

  try {
    context.data.users.push(user);
    context.data.tenants.push(tenant);
    context.data.rentSchedule.push(schedule);
    context.data.notifications.push(notification, adminNotification);
    if (!existingOccupant && tenantStatus === 'active') property.status = 'occupied';
    // These store writes become the corresponding API calls when the shared JSON overlay is replaced.
    context.save('users', context.data.users);
    context.save('tenants', context.data.tenants);
    context.save('properties', context.data.properties);
    context.save('rentSchedule', context.data.rentSchedule);
    context.save('tenantRequests', context.data.tenantRequests);
    context.save('notifications', context.data.notifications);
    context.save('auditLog', [...context.data.auditLog, createAudit(context.data, context, 'Approved', `${request.name} was approved for ${property.name}; tenant ${tenant.id} and rent schedule created.`)]);
    window.bootstrap.Modal.getInstance(host.querySelector('#approveRequestModal'))?.hide();
    renderResults();
    context.refresh();
    context.toast(`${request.name} added as a ${tenantStatus} tenant`);
  } catch (error) {
    context.toast(`Could not approve request: ${error.message}`, 'error');
  }
}
