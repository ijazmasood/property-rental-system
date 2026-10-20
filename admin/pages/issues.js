import { formatDate } from '../../data/helpers/date.js';

const ISSUE_STATUSES = ['open', 'in progress', 'awaiting tenant', 'resolved', 'closed'];
const BOARD_LANES = ['open', 'in progress', 'awaiting tenant', 'resolved'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function statusLabel(status) {
  return status.split(' ').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function priorityClass(priority) {
  return { urgent: 'danger', high: 'warning', medium: 'primary', low: 'secondary' }[priority] || 'secondary';
}

function getIssueRows(data) {
  const properties = new Map(data.properties.map((property) => [property.id, property]));
  const tenants = new Map(data.tenants.map((tenant) => [tenant.id, tenant]));
  const users = new Map(data.users.map((user) => [user.id, user]));
  return data.issues.map((issue) => ({
    ...issue,
    property: properties.get(issue.propertyId),
    tenant: tenants.get(issue.tenantId),
    assignedUser: users.get(issue.assignedTo)
  }));
}

function issueCard(issue) {
  const tone = priorityClass(issue.priority);
  return `<article class="panel-card h-100 p-3 issue-kanban-card" role="button" tabindex="0" data-action="open-issue" data-id="${escapeHtml(issue.id)}">
    <div class="d-flex justify-content-between gap-2 align-items-start"><span class="badge text-bg-${tone} bg-opacity-10 text-${tone} border border-${tone} border-opacity-10">${escapeHtml(issue.priority)}</span><span class="small text-secondary">${formatDate(issue.createdOn)}</span></div>
    <h3 class="h6 fw-bold mt-3 mb-1">${escapeHtml(issue.title)}</h3><p class="small text-secondary mb-2">${escapeHtml(issue.property?.name || 'Property unavailable')} · ${escapeHtml(issue.category)}</p>
    <div class="small text-secondary"><i class="bi bi-person me-1"></i>${escapeHtml(issue.tenant?.name || 'No tenant linked')}</div><div class="small text-secondary mt-1"><i class="bi bi-person-gear me-1"></i>${escapeHtml(issue.assignedUser?.name || 'Unassigned')}</div>
  </article>`;
}

function renderBoard(container, issues) {
  container.innerHTML = `<div class="row g-3">${BOARD_LANES.map((status) => {
    const lane = issues.filter((issue) => status === 'resolved' ? ['resolved', 'closed'].includes(issue.status) : issue.status === status);
    return `<div class="col-12 col-md-6 col-xl-3"><section class="h-100 p-3 rounded-3 bg-light border"><div class="d-flex justify-content-between align-items-center mb-3"><h2 class="h6 fw-bold mb-0">${statusLabel(status)}</h2><span class="badge rounded-pill bg-white text-secondary border">${lane.length}</span></div><div class="d-grid gap-2">${lane.length ? lane.map(issueCard).join('') : '<p class="small text-secondary text-center py-3 mb-0">No issues in this lane.</p>'}</div></section></div>`;
  }).join('')}</div>`;
}

function renderList(container, issues) {
  container.innerHTML = issues.length
    ? `<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Issue</th><th>Property / tenant</th><th>Priority</th><th>Status</th><th>Assigned to</th><th>Created</th><th></th></tr></thead><tbody>${issues.map((issue) => `<tr>
      <td><button class="btn btn-link p-0 text-start fw-semibold text-decoration-none" data-action="open-issue" data-id="${escapeHtml(issue.id)}">${escapeHtml(issue.title)}</button><div class="small text-secondary">${escapeHtml(issue.category)}</div></td><td>${escapeHtml(issue.property?.name || 'Property unavailable')}<div class="small text-secondary">${escapeHtml(issue.tenant?.name || 'No tenant')}</div></td><td><span class="badge text-bg-${priorityClass(issue.priority)} bg-opacity-10 text-${priorityClass(issue.priority)}">${escapeHtml(issue.priority)}</span></td><td>${escapeHtml(statusLabel(issue.status))}</td><td>${escapeHtml(issue.assignedUser?.name || 'Unassigned')}</td><td>${formatDate(issue.createdOn)}</td><td><button class="btn btn-sm btn-light" data-action="open-issue" data-id="${escapeHtml(issue.id)}" aria-label="View issue details"><i class="bi bi-arrow-up-right"></i></button></td>
    </tr>`).join('')}</tbody></table></div>`
    : '<div class="empty-state"><i class="bi bi-tools"></i>No issues match these filters.</div>';
}

function issueModal(issue, data, canEdit) {
  const comments = Array.isArray(issue.comments) ? issue.comments : [];
  const userNames = new Map(data.users.map((user) => [user.id, user.name]));
  const photoList = issue.photos?.length
    ? issue.photos.map((photo) => `<span class="badge bg-light text-secondary me-1">${escapeHtml(photo)}</span>`).join('')
    : '<span class="small text-secondary">No photos attached in this demo.</span>';
  return `<div class="modal fade" id="issueModal" tabindex="-1" aria-labelledby="issueModalTitle" aria-hidden="true"><div class="modal-dialog modal-lg modal-dialog-scrollable"><form class="modal-content" id="issueForm" data-issue-id="${escapeHtml(issue.id)}">
    <div class="modal-header"><div><p class="small text-secondary mb-1">${escapeHtml(issue.property?.name || 'Property unavailable')} · ${escapeHtml(issue.tenant?.name || 'No tenant')} · Reported ${formatDate(issue.createdOn)}</p><h2 class="modal-title fs-5" id="issueModalTitle">${escapeHtml(issue.title)}</h2></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
    <div class="modal-body"><p>${escapeHtml(issue.description)}</p><div class="mb-3"><span class="badge text-bg-${priorityClass(issue.priority)} bg-opacity-10 text-${priorityClass(issue.priority)}">${escapeHtml(issue.priority)} priority</span> <span class="badge bg-light text-secondary">${escapeHtml(issue.category)}</span></div>
      <div class="row g-3"><div class="col-md-6"><label class="form-label" for="issueStatus">Status</label><select class="form-select" id="issueStatus" name="status" ${canEdit ? '' : 'disabled'}>${ISSUE_STATUSES.map((status) => `<option value="${status}" ${issue.status === status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('')}</select></div>
      <div class="col-md-6"><label class="form-label" for="issueAssignee">Assigned to</label><select class="form-select" id="issueAssignee" name="assignedTo" ${canEdit ? '' : 'disabled'}><option value="">Unassigned</option>${data.users.filter((user) => ['admin', 'superadmin'].includes(user.role)).map((user) => `<option value="${escapeHtml(user.id)}" ${user.id === issue.assignedTo ? 'selected' : ''}>${escapeHtml(user.name)}</option>`).join('')}</select></div></div>
      <div class="mt-3"><h3 class="h6 fw-semibold">Photos</h3>${photoList}</div>
      <hr><h3 class="h6 fw-semibold">Comments and updates</h3><div class="d-grid gap-2 mb-3">${comments.length ? comments.map((comment) => `<div class="p-2 rounded bg-light"><div class="small fw-semibold">${escapeHtml(userNames.get(comment.by) || comment.by || 'Team member')} <span class="fw-normal text-secondary ms-1">${formatDate(comment.date)}</span></div><div class="small mt-1">${escapeHtml(comment.text)}</div></div>`).join('') : '<p class="small text-secondary">No comments yet.</p>'}</div>
      ${canEdit ? '<label class="form-label" for="issueComment">Add a comment (optional)</label><textarea class="form-control" id="issueComment" name="comment" rows="3" maxlength="1000" placeholder="Write an update for the tenant or team"></textarea>' : '<p class="small text-secondary mb-0">Accountant access is read-only.</p>'}
    </div><div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Close</button>${canEdit ? '<button type="submit" class="btn btn-forest">Save update</button>' : ''}</div>
  </form></div></div>`;
}

export function renderIssues(container, context) {
  const canEdit = context.role !== 'accountant';
  let view = 'board';
  container.innerHTML = `<div class="page-header"><div><p class="page-eyebrow">Operations</p><h1 class="page-title">Issues</h1><p class="page-subtitle">Track repairs and tenant reports from open to resolution.</p></div><div class="d-flex align-items-center gap-2">${canEdit ? '' : '<span class="small text-secondary">Read-only access</span>'}<div class="btn-group" role="group" aria-label="Issue display"><button class="btn btn-sm btn-forest" id="issueBoardView" aria-pressed="true"><i class="bi bi-kanban me-1"></i>Board</button><button class="btn btn-sm btn-light border" id="issueListView" aria-pressed="false"><i class="bi bi-list-ul me-1"></i>List</button></div></div></div>
    <div class="row g-3 mb-3"><div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Open issues</div><div class="stat-value">${context.data.issues.filter((issue) => issue.status === 'open').length}</div></div></div><div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Urgent / high priority</div><div class="stat-value text-danger">${context.data.issues.filter((issue) => ['urgent', 'high'].includes(issue.priority) && !['resolved', 'closed'].includes(issue.status)).length}</div></div></div><div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">In progress</div><div class="stat-value text-warning">${context.data.issues.filter((issue) => issue.status === 'in progress').length}</div></div></div><div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Awaiting tenant</div><div class="stat-value">${context.data.issues.filter((issue) => issue.status === 'awaiting tenant').length}</div></div></div></div>
    <section class="panel-card"><div class="row g-2 align-items-center mb-3"><div class="col-lg-6"><label class="visually-hidden" for="issueSearch">Search issues</label><input class="form-control form-control-sm" id="issueSearch" type="search" placeholder="Search title, property, tenant or category"></div><div class="col-6 col-lg-3"><label class="visually-hidden" for="issueStatusFilter">Filter status</label><select class="form-select form-select-sm" id="issueStatusFilter"><option value="">All statuses</option>${ISSUE_STATUSES.map((status) => `<option value="${status}">${statusLabel(status)}</option>`).join('')}</select></div><div class="col-6 col-lg-3"><label class="visually-hidden" for="issuePriorityFilter">Filter priority</label><select class="form-select form-select-sm" id="issuePriorityFilter"><option value="">All priorities</option>${PRIORITIES.map((priority) => `<option value="${priority}">${statusLabel(priority)}</option>`).join('')}</select></div></div><div id="issueResults"></div></section><div id="issueModalHost"></div>`;
  const results = container.querySelector('#issueResults');
  const update = () => {
    const query = container.querySelector('#issueSearch').value.trim().toLowerCase();
    const status = container.querySelector('#issueStatusFilter').value;
    const priority = container.querySelector('#issuePriorityFilter').value;
    const issues = getIssueRows(context.data).filter((issue) =>
      (!status || issue.status === status || (status === 'resolved' && issue.status === 'closed'))
      && (!priority || issue.priority === priority)
      && `${issue.title} ${issue.description} ${issue.category} ${issue.property?.name || ''} ${issue.tenant?.name || ''}`.toLowerCase().includes(query)
    );
    if (view === 'board') {
      const boardStatuses = new Set(BOARD_LANES);
      const visible = issues.filter((issue) => boardStatuses.has(issue.status) || issue.status === 'closed');
      renderBoard(results, visible);
    } else renderList(results, issues);
  };
  container.querySelector('#issueSearch').addEventListener('input', update);
  container.querySelector('#issueStatusFilter').addEventListener('change', update);
  container.querySelector('#issuePriorityFilter').addEventListener('change', update);
  container.querySelector('#issueBoardView').addEventListener('click', () => {
    view = 'board';
    container.querySelector('#issueBoardView').className = 'btn btn-sm btn-forest';
    container.querySelector('#issueListView').className = 'btn btn-sm btn-light border';
    container.querySelector('#issueBoardView').setAttribute('aria-pressed', 'true');
    container.querySelector('#issueListView').setAttribute('aria-pressed', 'false');
    update();
  });
  container.querySelector('#issueListView').addEventListener('click', () => {
    view = 'list';
    container.querySelector('#issueListView').className = 'btn btn-sm btn-forest';
    container.querySelector('#issueBoardView').className = 'btn btn-sm btn-light border';
    container.querySelector('#issueListView').setAttribute('aria-pressed', 'true');
    container.querySelector('#issueBoardView').setAttribute('aria-pressed', 'false');
    update();
  });
  update();
  container.onclick = (event) => {
    const button = event.target.closest('[data-action="open-issue"]');
    if (!button) return;
    const issue = getIssueRows(context.data).find((item) => item.id === button.dataset.id);
    if (!issue) return;
    openIssueModal(container, context, issue, canEdit, update);
  };
  container.onkeydown = (event) => {
    const card = event.target.closest('.issue-kanban-card');
    if (card && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      card.click();
    }
  };
}

function openIssueModal(container, context, issue, canEdit, update) {
  const host = container.querySelector('#issueModalHost');
  host.innerHTML = issueModal(issue, context.data, canEdit);
  const modalElement = host.querySelector('#issueModal');
  const form = host.querySelector('#issueForm');
  if (canEdit) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const record = context.data.issues.find((item) => item.id === issue.id);
      if (!record) {
        context.toast('This issue no longer exists.', 'error');
        return;
      }
      const nextStatus = values.get('status');
      const nextAssignee = values.get('assignedTo') || null;
      const commentText = values.get('comment').trim();
      if (!ISSUE_STATUSES.includes(nextStatus) || (nextAssignee && !context.data.users.some((user) => user.id === nextAssignee && ['admin', 'superadmin'].includes(user.role)))) {
        context.toast('Choose a valid issue status and team member.', 'error');
        return;
      }
      const statusChanged = record.status !== nextStatus;
      const assigneeChanged = record.assignedTo !== nextAssignee;
      if (!statusChanged && !assigneeChanged && !commentText) {
        context.toast('No issue changes to save.', 'info');
        return;
      }
      const oldStatus = record.status;
      record.status = nextStatus;
      record.assignedTo = nextAssignee;
      if (commentText) {
        record.comments = Array.isArray(record.comments) ? record.comments : [];
        record.comments.push({
          by: context.role === 'superadmin' ? 'u-admin' : 'u-manager',
          text: commentText,
          date: context.data.config.demoToday
        });
      }
      const tenant = context.data.tenants.find((item) => item.id === issue.tenantId);
      const notifications = [];
      if ((statusChanged || commentText) && tenant) {
        notifications.push({
          id: makeId('notification'),
          userId: tenant.userId,
          audience: 'tenant',
          title: statusChanged ? 'Issue updated' : 'New comment on your issue',
          body: `${record.title}:${statusChanged ? ` status changed from ${statusLabel(oldStatus)} to ${statusLabel(nextStatus)}.` : ''}${commentText ? ` ${statusChanged ? 'Team update:' : ''} ${commentText}` : ''}`.trim(),
          type: 'issue',
          createdOn: context.data.config.demoToday,
          read: false
        });
      }
      if (assigneeChanged && nextAssignee) {
        notifications.push({
          id: makeId('notification'),
          userId: nextAssignee,
          audience: 'admin',
          title: 'Issue assigned to you',
          body: `${record.title} at ${issue.property?.name || 'a property'} has been assigned to you.`,
          type: 'issue',
          createdOn: context.data.config.demoToday,
          read: false
        });
      }
      context.data.notifications.push(...notifications);
      const detailParts = [];
      if (statusChanged) detailParts.push(`status changed from ${oldStatus} to ${nextStatus}`);
      if (assigneeChanged) detailParts.push(`assignment changed to ${context.data.users.find((user) => user.id === nextAssignee)?.name || 'Unassigned'}`);
      if (commentText) detailParts.push('comment added');
      try {
        // These store writes become the issue, notification and audit API calls when a backend is introduced.
        context.save('issues', context.data.issues);
        if (notifications.length) context.save('notifications', context.data.notifications);
        context.save('auditLog', [...context.data.auditLog, {
          id: makeId('audit'),
          date: `${context.data.config.demoToday}T12:00:00`,
          userName: context.role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
          action: 'Updated',
          entity: 'Issue',
          detail: `${record.title}: ${detailParts.join('; ')}.`
        }]);
        window.bootstrap.Modal.getInstance(modalElement)?.hide();
        update();
        context.refresh();
        context.toast('Issue update saved');
      } catch (error) {
        context.toast(`Could not save issue update: ${error.message}`, 'error');
      }
    });
  }
  window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
}
