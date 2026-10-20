import { formatDate } from '../../data/helpers/date.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function auditEntry(context, action, detail) {
  return {
    id: makeId('audit'),
    date: `${context.data.config.demoToday}T12:00:00`,
    userName: context.role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
    action,
    entity: 'Notifications',
    detail
  };
}

function renderList(container, context) {
  const audience = container.querySelector('#notificationAudience').value;
  const status = container.querySelector('#notificationReadStatus').value;
  const type = container.querySelector('#notificationTypeFilter').value;
  const rows = context.data.notifications.filter((item) =>
    (!audience || item.audience === audience)
    && (!status || (status === 'unread' ? !item.read : Boolean(item.read)))
    && (!type || item.type === type)
  ).sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  container.querySelector('#notificationCount').textContent = `${rows.length} messages`;
  container.querySelector('#notificationRows').innerHTML = rows.length
    ? rows.map((notification) => `<article class="d-flex flex-wrap align-items-start justify-content-between gap-3 p-3 border-bottom ${notification.read ? '' : 'bg-light'}"><div class="d-flex gap-3"><span class="stat-icon"><i class="bi bi-${notification.type === 'rent' ? 'cash-stack' : notification.type === 'document' ? 'file-earmark-text' : notification.type === 'issue' ? 'tools' : notification.type === 'contract' ? 'file-earmark-check' : 'bell'}"></i></span><div><div class="d-flex align-items-center gap-2"><h3 class="h6 fw-semibold mb-0">${escapeHtml(notification.title)}</h3>${notification.read ? '' : '<span class="badge text-bg-primary">Unread</span>'}</div><p class="small text-secondary mb-1 mt-1">${escapeHtml(notification.body)}</p><span class="small text-secondary">${escapeHtml(notification.audience)} · ${escapeHtml(notification.type)} · ${formatDate(notification.createdOn)}${notification.userId ? ` · ${escapeHtml(notification.userId)}` : ''}</span></div></div><div>${!notification.read ? `<button class="btn btn-sm btn-outline-secondary" data-action="mark-read" data-id="${escapeHtml(notification.id)}">Mark read</button>` : '<span class="small text-secondary">Read</span>'}</div></article>`).join('')
    : '<div class="empty-state"><i class="bi bi-bell-slash"></i>No notifications match these filters.</div>';
}

export function renderNotifications(container, context) {
  const canManage = context.role !== 'accountant';
  const settings = context.data.config.notificationSettings || {};
  const channels = settings.channels || { inApp: true, email: false, push: false };
  const unread = context.data.notifications.filter((notification) => !notification.read).length;
  container.innerHTML = `<div class="page-header"><div><p class="page-eyebrow">Operations</p><h1 class="page-title">Notifications</h1><p class="page-subtitle">In-app updates and reminder preferences. External delivery is simulated only.</p></div><div class="d-flex gap-2 align-items-center"><span class="badge rounded-pill bg-light text-secondary">${unread} unread</span>${canManage ? '<button class="btn btn-light border" data-action="mark-all-read">Mark all read</button>' : '<span class="small text-secondary">Read-only access</span>'}</div></div>
    <section class="panel-card mb-3"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><div><h2 class="h6 fw-bold mb-1">Notification centre</h2><p class="small text-secondary mb-0">Records are shared with the tenant app where the audience is tenant.</p></div><span class="small text-secondary" id="notificationCount"></span></div>
      <div class="row g-2 mb-2"><div class="col-4"><label class="visually-hidden" for="notificationAudience">Audience</label><select id="notificationAudience" class="form-select form-select-sm"><option value="">All audiences</option><option value="admin">Admin</option><option value="tenant">Tenant</option></select></div><div class="col-4"><label class="visually-hidden" for="notificationReadStatus">Read status</label><select id="notificationReadStatus" class="form-select form-select-sm"><option value="">All messages</option><option value="unread">Unread</option><option value="read">Read</option></select></div><div class="col-4"><label class="visually-hidden" for="notificationTypeFilter">Type</label><select id="notificationTypeFilter" class="form-select form-select-sm"><option value="">All types</option>${['rent', 'document', 'issue', 'contract', 'system'].map((type) => `<option value="${type}">${type[0].toUpperCase()}${type.slice(1)}</option>`).join('')}</select></div></div>
      <div id="notificationRows"></div>
    </section>
    <section class="panel-card"><div class="d-flex justify-content-between align-items-start gap-2 mb-3"><div><h2 class="h6 fw-bold mb-1">Reminder rules and channels</h2><p class="small text-secondary mb-0">Rules use demoToday. External channels require a live provider.</p></div><span id="notificationLiveBadge"></span></div>
      <form id="notificationRulesForm"><div class="row g-3">
        <div class="col-md-6"><label class="form-label" for="documentReminderDays">Document reminder days before expiry</label><input class="form-control" id="documentReminderDays" name="reminderDays" value="${escapeHtml((context.data.config.reminderDays || []).join(', '))}" placeholder="60, 30, 7" pattern="\\s*\\d+(?:\\s*,\\s*\\d+)*\\s*"><div class="form-text">Comma-separated day offsets, such as 60, 30, 7.</div></div>
        <div class="col-md-6"><label class="form-label" for="rentReminderDays">Rent reminder days before due</label><input class="form-control" id="rentReminderDays" name="rentReminderDaysBefore" type="number" min="0" max="60" value="${escapeHtml(context.data.config.rentReminderDaysBefore)}" required></div>
        <div class="col-12"><div class="form-check"><input class="form-check-input" id="overdueAlerts" name="overdueAlerts" type="checkbox" ${settings.overdueAlerts === false ? '' : 'checked'} ${canManage ? '' : 'disabled'}><label class="form-check-label" for="overdueAlerts">Show in-app overdue alerts</label></div></div>
        <div class="col-12"><h3 class="h6 fw-semibold mb-2">Delivery channels</h3><div class="d-flex flex-wrap gap-4"><div class="form-check"><input class="form-check-input" id="channelInApp" type="checkbox" ${channels.inApp ? 'checked' : ''} ${canManage ? '' : 'disabled'}><label class="form-check-label" for="channelInApp">In-app</label></div><div class="form-check"><input class="form-check-input" id="channelEmail" type="checkbox" ${channels.email ? 'checked' : ''} ${canManage ? '' : 'disabled'}><label class="form-check-label" for="channelEmail">Email</label></div><div class="form-check"><input class="form-check-input" id="channelPush" type="checkbox" ${channels.push ? 'checked' : ''} ${canManage ? '' : 'disabled'}><label class="form-check-label" for="channelPush">Push</label></div></div></div>
      </div><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3"><span class="small text-secondary">Email and push selections are preferences only; no external messages are sent.</span>${canManage ? '<button class="btn btn-forest" type="submit">Save reminder settings</button>' : ''}</div></form>
    </section>`;
  container.querySelector('#notificationLiveBadge').replaceWith(context.createNeedsLiveBadge('notifications', 'Email / push delivery needs live system'));
  const updateList = () => renderList(container, context);
  for (const selector of ['#notificationAudience', '#notificationReadStatus', '#notificationTypeFilter']) {
    container.querySelector(selector).addEventListener('change', updateList);
  }
  updateList();
  if (!canManage) return;
  container.onclick = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const affected = button.dataset.action === 'mark-all-read'
      ? context.data.notifications.filter((item) => !item.read)
      : [context.data.notifications.find((item) => item.id === button.dataset.id)].filter(Boolean);
    if (!affected.length) return;
    affected.forEach((item) => { item.read = true; });
    try {
      // These store writes become the notification and audit API calls when a backend is introduced.
      context.save('notifications', context.data.notifications);
      context.save('auditLog', [...context.data.auditLog, auditEntry(context, 'Marked read', `${affected.length} notification${affected.length === 1 ? '' : 's'} marked read.`)]);
      updateList();
      context.toast(`${affected.length} notification${affected.length === 1 ? '' : 's'} marked read`);
    } catch (error) {
      context.toast(`Could not update notifications: ${error.message}`, 'error');
    }
  };
  container.querySelector('#notificationRulesForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const reminderDays = form.elements.namedItem('reminderDays').value
      .split(',').map((day) => Number(day.trim())).filter((day) => Number.isInteger(day) && day >= 0 && day <= 365);
    if (!reminderDays.length) {
      context.toast('Enter at least one reminder day from 0 to 365.', 'error');
      return;
    }
    const config = {
      ...context.data.config,
      reminderDays: [...new Set(reminderDays)].sort((a, b) => b - a),
      rentReminderDaysBefore: Number(form.elements.namedItem('rentReminderDaysBefore').value),
      notificationSettings: {
        overdueAlerts: form.elements.namedItem('overdueAlerts').checked,
        channels: {
          inApp: container.querySelector('#channelInApp').checked,
          email: container.querySelector('#channelEmail').checked,
          push: container.querySelector('#channelPush').checked
        }
      }
    };
    try {
      // These store writes become the reminder-preferences and audit API calls when a backend is introduced.
      context.save('config', config);
      context.save('auditLog', [...context.data.auditLog, auditEntry(context, 'Updated reminder settings', `Document reminders: ${config.reminderDays.join(', ')} days; rent reminder: ${config.rentReminderDaysBefore} days before due.`)]);
      context.refresh();
      context.toast('Reminder settings saved');
    } catch (error) {
      context.toast(`Could not save reminder settings: ${error.message}`, 'error');
    }
  });
}
