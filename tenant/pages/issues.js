import { formatDate } from '../../data/helpers/date.js';
import { auditEntry, escapeHtml, makeId, notificationEntry, openSheet, sheetHeader } from './shared.js';

const STATUS_LABELS = {
  open: 'Open',
  'in progress': 'In progress',
  'awaiting tenant': 'Awaiting tenant',
  resolved: 'Resolved',
  closed: 'Closed'
};

function priorityTone(priority) {
  return priority === 'urgent' || priority === 'high' ? 'danger' : priority === 'medium' ? 'warning' : '';
}

function renderIssueRows(container, context) {
  const issues = context.data.issues.filter((issue) => issue.tenantId === context.tenant.id)
    .sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  container.querySelector('#issueCount').textContent = `${issues.length} ${issues.length === 1 ? 'request' : 'requests'}`;
  container.querySelector('#tenantIssueList').innerHTML = issues.length ? issues.map((issue) => {
    const comments = Array.isArray(issue.comments) ? issue.comments : [];
    return `<button type="button" class="tenant-card issue-list-card text-start w-100 mb-2" data-action="view-issue" data-id="${escapeHtml(issue.id)}">
      <div class="d-flex justify-content-between gap-2 align-items-start"><span class="status-pill ${priorityTone(issue.priority)}">${escapeHtml(issue.priority)} priority</span><span class="small text-secondary">${formatDate(issue.createdOn)}</span></div>
      <h2 class="h6 fw-bold mt-2 mb-1">${escapeHtml(issue.title)}</h2>
      <p class="small text-secondary mb-2">${escapeHtml(issue.category)}</p>
      <div class="d-flex justify-content-between align-items-center"><span class="status-pill ${['resolved', 'closed'].includes(issue.status) ? '' : 'warning'}">${escapeHtml(STATUS_LABELS[issue.status] || issue.status)}</span><span class="small text-secondary"><i class="bi bi-chat-dots me-1"></i>${comments.length}</span></div>
    </button>`;
  }).join('') : '<section class="tenant-card"><div class="empty-state"><i class="bi bi-tools"></i>No repair requests yet.</div></section>';
}

function openIssueDetail(container, context, issue) {
  const comments = Array.isArray(issue.comments) ? issue.comments : [];
  const photoNames = Array.isArray(issue.photos) ? issue.photos : [];
  const sheet = openSheet(`${sheetHeader(issue.title, `${issue.category} · Reported ${formatDate(issue.createdOn)}`)}
    <div class="tenant-sheet-body">
      <div class="d-flex gap-2 mb-3"><span class="status-pill ${priorityTone(issue.priority)}">${escapeHtml(issue.priority)} priority</span><span class="status-pill ${['resolved', 'closed'].includes(issue.status) ? '' : 'warning'}">${escapeHtml(STATUS_LABELS[issue.status] || issue.status)}</span></div>
      <section class="tenant-card mb-3"><h3 class="small fw-bold">Your report</h3><p class="small mb-0">${escapeHtml(issue.description)}</p>${photoNames.length ? `<p class="small text-secondary mt-2 mb-0"><i class="bi bi-paperclip me-1"></i>${photoNames.map(escapeHtml).join(', ')}</p>` : ''}</section>
      <h3 class="small fw-bold mb-2">Updates</h3>
      <div class="issue-timeline">${comments.length ? comments.map((comment) => `<article class="timeline-item"><span class="timeline-dot"></span><div class="small fw-semibold">${comment.by === context.tenant.userId ? 'You' : escapeHtml(context.data.users.find((user) => user.id === comment.by)?.name || 'Property team')}<span class="text-secondary fw-normal ms-2">${formatDate(comment.date)}</span></div><p class="small mt-1 mb-0">${escapeHtml(comment.text)}</p></article>`).join('') : `<article class="timeline-item"><span class="timeline-dot"></span><div class="small fw-semibold">Request received <span class="text-secondary fw-normal ms-2">${formatDate(issue.createdOn)}</span></div><p class="small mt-1 mb-0">The property team will review your report.</p></article>`}</div>
      <form id="issueReplyForm" class="mt-3"><label class="form-label small fw-semibold" for="issueReply">Add a comment</label><textarea class="form-control" id="issueReply" name="comment" rows="2" maxlength="1000" required placeholder="Send an update to your property team"></textarea><button class="btn tenant-btn-primary w-100 mt-2" type="submit">Send update</button></form>
    </div>`);
  sheet.element.querySelector('#issueReplyForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const record = context.data.issues.find((item) => item.id === issue.id && item.tenantId === context.tenant.id);
    if (!record) {
      context.toast('This repair request is no longer available.', 'error');
      return;
    }
    const text = new FormData(form).get('comment').trim();
    if (!text) return;
    record.comments = [...(Array.isArray(record.comments) ? record.comments : []), {
      by: context.tenant.userId,
      text,
      date: context.data.config.demoToday
    }];
    const adminNotice = notificationEntry(context, 'admin', 'Tenant replied to an issue', `${context.tenant.name} added an update to "${record.title}".`, 'u-admin', 'issue');
    try {
      // These store writes become the issue, notification and audit API calls when a backend is introduced.
      context.save('issues', context.data.issues);
      context.save('notifications', [...context.data.notifications, adminNotice]);
      context.save('auditLog', [...context.data.auditLog, auditEntry(context, 'Commented', 'Issue', `Tenant added an update to "${record.title}".`)]);
      context.toast('Your update was sent to the property team');
      sheet.close();
      context.refresh();
    } catch (error) {
      context.toast(`Could not send update: ${error.message}`, 'error');
    }
  });
}

function openIssueForm(container, context) {
  let previewUrl;
  const sheet = openSheet(`${sheetHeader('Report an issue', 'Tell your property team what needs attention')}
    <div class="tenant-sheet-body">
      <form id="newIssueForm">
        <div class="mb-3"><label class="form-label small fw-semibold" for="newIssueTitle">Issue title</label><input class="form-control" id="newIssueTitle" name="title" required maxlength="100" placeholder="e.g. Kitchen tap dripping"></div>
        <div class="row g-2"><div class="col-7"><label class="form-label small fw-semibold" for="newIssueCategory">Category</label><select class="form-select" id="newIssueCategory" name="category" required>${['Plumbing', 'Heating', 'Electrical', 'Appliance', 'Security', 'Windows', 'Safety', 'General'].map((item) => `<option>${item}</option>`).join('')}</select></div><div class="col-5"><label class="form-label small fw-semibold" for="newIssuePriority">Priority</label><select class="form-select" id="newIssuePriority" name="priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div></div>
        <div class="mt-3 mb-3"><label class="form-label small fw-semibold" for="newIssueDescription">Description</label><textarea class="form-control" id="newIssueDescription" name="description" rows="4" required maxlength="1200" placeholder="Describe what happened and where"></textarea></div>
        <div class="mb-3"><label class="form-label small fw-semibold" for="issuePhoto">Photo (optional)</label><input class="form-control" id="issuePhoto" type="file" accept="image/*"><div class="form-text">The demo records the file name only; it does not upload or store photo data.</div><button class="live-badge-static mt-2" type="button" data-live-feature="storage"><i class="bi bi-cloud-lock"></i>Photo storage needs live system</button><div id="issuePhotoPreview" class="small text-secondary mt-2"></div></div>
        <button class="btn tenant-btn-primary w-100" type="submit">Send repair request</button>
      </form>
    </div>`, () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });
  const fileInput = sheet.element.querySelector('#issuePhoto');
  fileInput.addEventListener('change', () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const file = fileInput.files?.[0];
    previewUrl = file?.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    sheet.element.querySelector('#issuePhotoPreview').innerHTML = file
      ? `${escapeHtml(file.name)}${previewUrl ? `<img class="issue-photo-preview" src="${previewUrl}" alt="Selected issue photo preview">` : ''}`
      : '';
  });
  sheet.element.querySelector('#newIssueForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const title = values.get('title').trim();
    const issue = {
      id: makeId('issue'),
      propertyId: context.tenant.propertyId,
      tenantId: context.tenant.id,
      title,
      description: values.get('description').trim(),
      category: values.get('category'),
      priority: values.get('priority'),
      status: 'open',
      photos: fileInput.files?.[0] ? [fileInput.files[0].name] : [],
      assignedTo: null,
      createdOn: context.data.config.demoToday,
      comments: []
    };
    const adminNotice = notificationEntry(context, 'admin', 'New repair request', `${context.tenant.name} reported "${title}" at ${context.property.name}.`, 'u-admin', 'issue');
    try {
      // These store writes become the issue, notification and audit API calls when a backend is introduced.
      context.save('issues', [...context.data.issues, issue]);
      context.save('notifications', [...context.data.notifications, adminNotice]);
      context.save('auditLog', [...context.data.auditLog, auditEntry(context, 'Reported', 'Issue', `${context.tenant.name} reported "${title}" at ${context.property.name}.`)]);
      sheet.close();
      context.refresh();
      context.toast('Your repair request was sent');
    } catch (error) {
      context.toast(`Could not send repair request: ${error.message}`, 'error');
    }
  });
}

export function renderIssues(container, context) {
  container.innerHTML = `<div class="page-enter"><div class="d-flex justify-content-between align-items-start gap-2"><div><h1 class="tenant-page-title">Issues</h1><p class="tenant-page-subtitle">Report repairs and follow updates.</p></div><button class="btn btn-sm tenant-btn-primary" type="button" data-action="new-issue"><i class="bi bi-plus-lg me-1"></i>Report</button></div>
    <div class="d-flex justify-content-between align-items-center mb-2"><span class="small text-secondary">Your repair requests</span><span class="small text-secondary" id="issueCount"></span></div><div id="tenantIssueList"></div></div>`;
  renderIssueRows(container, context);
  container.onclick = (event) => {
    if (event.target.closest('[data-action="new-issue"]')) {
      openIssueForm(container, context);
      return;
    }
    const button = event.target.closest('[data-action="view-issue"]');
    if (!button) return;
    const issue = context.data.issues.find((item) => item.id === button.dataset.id && item.tenantId === context.tenant.id);
    if (issue) openIssueDetail(container, context, issue);
  };
}
