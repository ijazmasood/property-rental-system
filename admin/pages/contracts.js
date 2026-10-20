import { formatDate } from '../../data/helpers/date.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function renderRows(container, context) {
  const query = container.querySelector('#contractSearch').value.trim().toLowerCase();
  const statusFilter = container.querySelector('#contractStatusFilter').value;
  const tenants = new Map(context.data.tenants.map((tenant) => [tenant.id, tenant]));
  const properties = new Map(context.data.properties.map((property) => [property.id, property]));
  const rows = context.data.contracts.filter((contract) => {
    const tenant = tenants.get(contract.tenantId);
    return (!statusFilter || contract.status === statusFilter)
      && `${contract.title} ${tenant?.name || ''} ${properties.get(contract.propertyId)?.name || ''}`.toLowerCase().includes(query);
  }).sort((a, b) => (b.sentOn || '').localeCompare(a.sentOn || ''));
  container.querySelector('#contractCount').textContent = `${rows.length} contracts`;
  container.querySelector('#contractRows').innerHTML = rows.length
    ? rows.map((contract) => {
      const tenant = tenants.get(contract.tenantId);
      const property = properties.get(contract.propertyId);
      const tone = { draft: 'secondary', sent: 'warning', approved: 'success' }[contract.status] || 'secondary';
      return `<tr><td><strong>${escapeHtml(contract.title)}</strong><div class="small text-secondary">Version ${escapeHtml(contract.version)}</div></td><td>${escapeHtml(tenant?.name || 'Tenant unavailable')}<div class="small text-secondary">${escapeHtml(property?.name || 'Property unavailable')}</div></td><td>${formatDate(contract.startDate)} – ${formatDate(contract.endDate)}</td><td><span class="badge text-bg-${tone} bg-opacity-10 text-${tone}">${escapeHtml(contract.status[0].toUpperCase() + contract.status.slice(1))}</span></td><td>${contract.sentOn ? formatDate(contract.sentOn) : '—'}</td><td>${contract.approvedOn ? formatDate(contract.approvedOn) : '—'}</td><td class="text-end">${context.role !== 'accountant' && contract.status === 'draft' ? `<button class="btn btn-sm btn-forest" data-action="send-contract" data-id="${escapeHtml(contract.id)}">Send to tenant</button>` : contract.status === 'sent' ? '<span class="small text-secondary">Awaiting tenant</span>' : ''}</td></tr>`;
    }).join('')
    : '<tr><td colspan="7"><div class="empty-state"><i class="bi bi-file-earmark-check"></i>No contracts match this filter.</div></td></tr>';
}

export function renderContracts(container, context) {
  container.innerHTML = `<div class="page-header"><div><p class="page-eyebrow">Operations</p><h1 class="page-title">Contracts</h1><p class="page-subtitle">Track agreements sent to tenants and their approval status.</p></div><div class="d-flex align-items-center gap-2">${context.role === 'accountant' ? '<span class="small text-secondary">Read-only access</span>' : ''}<span id="esignBadge"></span></div></div>
    <section class="panel-card"><div class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3"><div><h2 class="h6 fw-bold mb-1">Tenancy agreements</h2><p class="small text-secondary mb-0">Sending updates the shared contract record; electronic signatures are simulated.</p></div><span class="small text-secondary" id="contractCount"></span></div>
      <div class="row g-2 mb-3"><div class="col-md-8"><label class="visually-hidden" for="contractSearch">Search contracts</label><input class="form-control form-control-sm" type="search" id="contractSearch" placeholder="Search tenant, property or contract"></div><div class="col-md-4"><label class="visually-hidden" for="contractStatusFilter">Filter status</label><select class="form-select form-select-sm" id="contractStatusFilter"><option value="">All statuses</option><option value="draft">Draft</option><option value="sent">Awaiting approval</option><option value="approved">Approved</option></select></div></div>
      <div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Agreement</th><th>Tenant / property</th><th>Tenancy</th><th>Status</th><th>Sent</th><th>Approved</th><th></th></tr></thead><tbody id="contractRows"></tbody></table></div>
    </section>`;
  container.querySelector('#esignBadge').replaceWith(context.createNeedsLiveBadge('signatures', 'E-signature needs live system'));
  const update = () => renderRows(container, context);
  container.querySelector('#contractSearch').addEventListener('input', update);
  container.querySelector('#contractStatusFilter').addEventListener('change', update);
  update();
  container.onclick = (event) => {
    const button = event.target.closest('[data-action="send-contract"]');
    if (!button) return;
    const contract = context.data.contracts.find((item) => item.id === button.dataset.id);
    if (!contract || contract.status !== 'draft') return;
    const tenant = context.data.tenants.find((item) => item.id === contract.tenantId);
    if (!tenant) {
      context.toast('The contract tenant no longer exists.', 'error');
      return;
    }
    if (!window.confirm(`Send "${contract.title}" to ${tenant.name} for review?`)) return;
    contract.status = 'sent';
    contract.sentOn = context.data.config.demoToday;
    contract.approvedOn = null;
    context.data.notifications.push({
      id: makeId('notification'),
      userId: tenant.userId,
      audience: 'tenant',
      title: 'Contract ready for review',
      body: `${contract.title} is ready for your review in the tenant app.`,
      type: 'contract',
      createdOn: context.data.config.demoToday,
      read: false
    });
    context.data.notifications.push({
      id: makeId('notification'),
      userId: context.role === 'superadmin' ? 'u-admin' : 'u-manager',
      audience: 'admin',
      title: 'Contract sent to tenant',
      body: `${contract.title} was sent to ${tenant.name}.`,
      type: 'contract',
      createdOn: context.data.config.demoToday,
      read: false
    });
    try {
      // These store writes become the contract and notification API calls when a backend is introduced.
      context.save('contracts', context.data.contracts);
      context.save('notifications', context.data.notifications);
      context.save('auditLog', [...context.data.auditLog, {
        id: makeId('audit'),
        date: `${context.data.config.demoToday}T12:00:00`,
        userName: context.role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
        action: 'Sent for approval',
        entity: 'Contract',
        detail: `${contract.title} was sent to ${tenant.name}; electronic signature is not collected in the demo.`
      }]);
      context.refresh();
      context.toast(`Contract sent to ${tenant.name}`);
    } catch (error) {
      context.toast(`Could not send contract: ${error.message}`, 'error');
    }
  };
}
