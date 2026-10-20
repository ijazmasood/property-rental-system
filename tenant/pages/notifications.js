import { daysBetween, formatDate } from '../../data/helpers/date.js';
import { auditEntry, escapeHtml } from './shared.js';

const ROUTES = {
  rent: '/payments',
  issue: '/issues',
  document: '/documents',
  contract: '/contracts',
  system: '/more'
};

function groupLabel(date, config) {
  const age = daysBetween(date, config.demoToday);
  if (age === 0) return 'Today';
  if (age === 1) return 'Yesterday';
  if (age >= 2 && age < 7) return formatDate(date, { weekday: 'long' });
  return formatDate(date);
}

export function renderNotifications(container, context) {
  const notifications = context.data.notifications.filter((item) =>
    item.audience === 'tenant' && (!item.userId || item.userId === context.tenant.userId)
  ).sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  const groups = new Map();
  for (const notification of notifications) {
    if (!groups.has(notification.createdOn)) groups.set(notification.createdOn, []);
    groups.get(notification.createdOn).push(notification);
  }
  container.innerHTML = `<div class="page-enter"><h1 class="tenant-page-title">Notifications</h1><p class="tenant-page-subtitle">Updates from your landlord and the app.</p><div class="d-flex justify-content-between align-items-center mb-2"><span class="small text-secondary">${notifications.length} ${notifications.length === 1 ? 'message' : 'messages'}</span><button class="btn btn-sm btn-light border" type="button" data-action="mark-all-read" ${notifications.every((item) => item.read) ? 'disabled' : ''}>Mark all read</button></div>
    ${groups.size ? [...groups.entries()].map(([date, items]) => `<section class="notification-group"><h2 class="notification-group-title">${escapeHtml(groupLabel(date, context.data.config))}</h2><div class="tenant-card">${items.map((item) => `<article class="notification-row notification-action ${item.read ? '' : 'unread'}" tabindex="0" role="button" data-notification-id="${escapeHtml(item.id)}"><span class="notification-icon"><i class="bi bi-${item.type === 'rent' ? 'cash-stack' : item.type === 'issue' ? 'tools' : item.type === 'document' ? 'file-earmark-text' : item.type === 'contract' ? 'file-earmark-check' : 'bell'}"></i></span><div class="notification-copy"><div class="d-flex justify-content-between gap-2"><strong>${escapeHtml(item.title)}</strong>${item.read ? '' : '<span class="unread-dot" aria-label="Unread"></span>'}</div><p>${escapeHtml(item.body)}</p><p>${formatDate(item.createdOn)} · Tap to view</p></div></article>`).join('')}</div></section>`).join('') : `<section class="tenant-card"><div class="empty-state"><i class="bi bi-bell-slash"></i>No notifications yet. Updates about your tenancy will appear here.</div></section>`}
  </div>`;
  container.onclick = (event) => {
    const allButton = event.target.closest('[data-action="mark-all-read"]');
    const row = event.target.closest('[data-notification-id]');
    if (!allButton && !row) return;
    const changed = allButton
      ? notifications.filter((item) => !item.read)
      : notifications.filter((item) => item.id === row.dataset.notificationId && !item.read);
    if (changed.length) {
      const changedIds = new Set(changed.map((item) => item.id));
      const nextNotifications = context.data.notifications.map((item) =>
        changedIds.has(item.id) ? { ...item, read: true } : item
      );
      try {
        // These store writes become the notification and audit API calls when a backend is introduced.
        context.save('notifications', nextNotifications);
        context.save('auditLog', [...context.data.auditLog, auditEntry(context, 'Marked read', 'Notification', allButton ? `Tenant marked ${changed.length} notification(s) as read.` : `Tenant read "${changed[0].title}".`)]);
        context.refresh();
      } catch (error) {
        context.toast(`Could not update notifications: ${error.message}`, 'error');
        return;
      }
    }
    if (row) {
      const notification = notifications.find((item) => item.id === row.dataset.notificationId);
      if (notification) window.location.hash = `#${ROUTES[notification.type] || '/home'}`;
    }
  };
  container.onkeydown = (event) => {
    const row = event.target.closest('[data-notification-id]');
    if (row && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      row.click();
    }
  };
}
