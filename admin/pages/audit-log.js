import { formatDate } from '../../data/helpers/date.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function renderAuditLog(container, context) {
  container.innerHTML = `<div class="page-header"><div><p class="page-eyebrow">Administration</p><h1 class="page-title">Audit Log</h1><p class="page-subtitle">Chronological record of changes made in the shared demo dataset.</p></div><span class="badge bg-light text-secondary">${context.data.auditLog.length} entries</span></div>
    <section class="panel-card"><div class="row g-2 mb-3"><div class="col-md-4"><label class="visually-hidden" for="auditSearch">Search audit log</label><input class="form-control form-control-sm" type="search" id="auditSearch" placeholder="Search action, user or detail"></div><div class="col-6 col-md-3"><label class="visually-hidden" for="auditEntity">Filter entity</label><select class="form-select form-select-sm" id="auditEntity"><option value="">All entities</option>${[...new Set(context.data.auditLog.map((entry) => entry.entity))].sort().map((entity) => `<option value="${escapeHtml(entity)}">${escapeHtml(entity)}</option>`).join('')}</select></div><div class="col-6 col-md-2"><label class="form-label small mb-1" for="auditFrom">From</label><input class="form-control form-control-sm" type="date" id="auditFrom"></div><div class="col-6 col-md-2"><label class="form-label small mb-1" for="auditTo">To</label><input class="form-control form-control-sm" type="date" id="auditTo" max="${escapeHtml(context.data.config.demoToday)}"></div><div class="col-6 col-md-1 d-flex align-items-end"><button class="btn btn-sm btn-light border w-100" id="clearAuditFilters">Clear</button></div></div>
      <div class="d-flex justify-content-between align-items-center mb-2"><h2 class="h6 fw-bold mb-0">Activity</h2><span id="auditCount" class="small text-secondary"></span></div><div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Date / time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody id="auditRows"></tbody></table></div>
    </section>`;
  const update = () => {
    const query = container.querySelector('#auditSearch').value.trim().toLowerCase();
    const entity = container.querySelector('#auditEntity').value;
    const from = container.querySelector('#auditFrom').value;
    const to = container.querySelector('#auditTo').value;
    const rows = context.data.auditLog.filter((entry) => {
      const date = entry.date.slice(0, 10);
      return (!entity || entry.entity === entity)
        && (!from || date >= from)
        && (!to || date <= to)
        && `${entry.userName} ${entry.action} ${entry.entity} ${entry.detail}`.toLowerCase().includes(query);
    }).sort((a, b) => b.date.localeCompare(a.date));
    container.querySelector('#auditCount').textContent = `${rows.length} entries`;
    container.querySelector('#auditRows').innerHTML = rows.length
      ? rows.map((entry) => `<tr><td>${formatDate(entry.date)}<div class="small text-secondary">${escapeHtml((entry.date.split('T')[1] || '').slice(0, 5))}</div></td><td>${escapeHtml(entry.userName)}</td><td><span class="badge bg-light text-secondary">${escapeHtml(entry.action)}</span></td><td>${escapeHtml(entry.entity)}</td><td>${escapeHtml(entry.detail)}</td></tr>`).join('')
      : '<tr><td colspan="5"><div class="empty-state"><i class="bi bi-clock-history"></i>No audit entries match these filters.</div></td></tr>';
  };
  for (const selector of ['#auditSearch', '#auditEntity', '#auditFrom', '#auditTo']) {
    container.querySelector(selector).addEventListener(selector === '#auditSearch' ? 'input' : 'change', update);
  }
  container.querySelector('#clearAuditFilters').addEventListener('click', () => {
    container.querySelector('#auditSearch').value = '';
    container.querySelector('#auditEntity').value = '';
    container.querySelector('#auditFrom').value = '';
    container.querySelector('#auditTo').value = '';
    update();
  });
  update();
}
