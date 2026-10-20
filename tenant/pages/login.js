import { formatDate } from '../../data/helpers/date.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

export function renderLogin(container, context) {
  const activeTenants = context.data.tenants.filter((tenant) => tenant.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name));
  const selectedTenant = activeTenants.find((tenant) => tenant.id === 't1') || activeTenants[0];
  const properties = context.data.properties;
  container.innerHTML = `<div class="login-wrap">
    <div class="login-logo"><i class="bi bi-house-heart"></i></div>
    <p class="tenant-greeting mb-1">WELCOME HOME</p>
    <h1 class="tenant-page-title mb-2">Your home, made easier.</h1>
    <p class="tenant-page-subtitle mb-3">Sign in to manage rent, repairs and documents in one place.</p>
    <section class="login-panel">
      <form id="tenantLoginForm">
        <label class="form-label" for="demoTenant">Choose your demo account</label>
        <select class="form-select mb-3" id="demoTenant" name="tenantId" required>${activeTenants.map((tenant) => `<option value="${escapeHtml(tenant.id)}" ${tenant.id === selectedTenant?.id ? 'selected' : ''}>${escapeHtml(tenant.name)}</option>`).join('')}</select>
        <button class="btn tenant-btn-primary w-100" type="submit">Continue as ${escapeHtml(selectedTenant?.name || 'tenant')} <i class="bi bi-arrow-right ms-1"></i></button>
      </form>
      <div class="login-badge-line"><span id="loginAuthBadge"></span></div>
      <button class="btn btn-light border w-100 mt-2" id="joinPropertyToggle" type="button"><i class="bi bi-key me-1"></i>Request to join a property</button>
      <form class="d-none mt-3" id="joinPropertyForm">
        <h2 class="h6 fw-bold mb-3">Request to join</h2>
        <div class="mb-2"><label class="form-label" for="joinProperty">Property</label><select class="form-select" id="joinProperty" name="propertyId" required><option value="">Choose a property</option>${properties.map((property) => `<option value="${escapeHtml(property.id)}">${escapeHtml(property.name)} · ${escapeHtml(property.postcode)}</option>`).join('')}</select></div>
        <div class="mb-2"><label class="form-label" for="joinName">Full name</label><input class="form-control" id="joinName" name="name" autocomplete="name" required maxlength="100"></div>
        <div class="mb-2"><label class="form-label" for="joinEmail">Email address</label><input class="form-control" id="joinEmail" name="email" type="email" autocomplete="email" required maxlength="160"></div>
        <div class="mb-2"><label class="form-label" for="joinPhone">Phone number</label><input class="form-control" id="joinPhone" name="phone" type="tel" autocomplete="tel" required maxlength="30" placeholder="07700 900000"></div>
        <div class="mb-3"><label class="form-label" for="joinMessage">Message (optional)</label><textarea class="form-control" id="joinMessage" name="message" rows="2" maxlength="500"></textarea></div>
        <button class="btn tenant-btn-primary w-100" type="submit">Send request</button>
      </form>
    </section>
    <p class="text-center text-secondary small mt-3 mb-0">Demo date · ${formatDate(context.data.config.demoToday)}</p>
  </div>`;
  container.querySelector('#loginAuthBadge').replaceWith(
    context.createNeedsLiveBadge('authentication', 'Biometric sign-in needs live system')
  );

  container.querySelector('#tenantLoginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const tenantId = new FormData(event.currentTarget).get('tenantId');
    if (!activeTenants.some((tenant) => tenant.id === tenantId)) {
      context.toast('Choose an active demo tenant to continue.', 'error');
      return;
    }
    context.onLogin(tenantId);
  });
  container.querySelector('#joinPropertyToggle').addEventListener('click', (event) => {
    const form = container.querySelector('#joinPropertyForm');
    form.classList.toggle('d-none');
    event.currentTarget.setAttribute('aria-expanded', String(!form.classList.contains('d-none')));
    if (!form.classList.contains('d-none')) form.querySelector('input').focus();
  });
  container.querySelector('#joinPropertyForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const request = {
      id: makeId('request'),
      name: values.get('name').trim(),
      email: values.get('email').trim().toLowerCase(),
      phone: values.get('phone').trim(),
      propertyId: values.get('propertyId'),
      message: values.get('message').trim(),
      requestedOn: context.data.config.demoToday,
      status: 'pending'
    };
    const property = properties.find((item) => item.id === request.propertyId);
    const nextAudit = [...context.data.auditLog, {
      id: makeId('audit'),
      date: `${context.data.config.demoToday}T12:00:00`,
      userName: request.name,
      action: 'Requested to join',
      entity: 'Tenant request',
      detail: `${request.name} requested to join ${property?.name || 'a property'}.`
    }];
    const nextNotifications = [...context.data.notifications, {
      id: makeId('notification'),
      userId: 'u-admin',
      audience: 'admin',
      title: 'New tenant request',
      body: `${request.name} requested to join ${property?.name || 'a property'}.`,
      type: 'system',
      createdOn: context.data.config.demoToday,
      read: false
    }];
    try {
      // This store write becomes the tenant-request API call when a backend is introduced.
      context.save('tenantRequests', [...context.data.tenantRequests, request]);
      // This store write becomes the notification API call when a backend is introduced.
      context.save('notifications', nextNotifications);
      // This store write becomes the audit API call when a backend is introduced.
      context.save('auditLog', nextAudit);
      context.toast('Request sent to the property team');
      form.reset();
      form.classList.add('d-none');
      container.querySelector('#joinPropertyToggle').setAttribute('aria-expanded', 'false');
    } catch (error) {
      context.toast(`Could not send request: ${error.message}`, 'error');
    }
  });
}
