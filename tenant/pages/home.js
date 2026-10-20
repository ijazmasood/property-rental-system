import { formatCurrency } from '../../data/helpers/currency.js';
import { daysBetween, formatDate } from '../../data/helpers/date.js';
import { getRentStatus } from '../../data/helpers/status.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function routeButton(route, label, icon, className = '') {
  return `<a class="${className}" href="#${route}">${icon ? `<i class="bi ${icon}" aria-hidden="true"></i>` : ''}<span>${label}</span></a>`;
}

export function renderHome(container, context) {
  const { tenant, property, data } = context;
  if (!tenant || !property) {
    container.innerHTML = '<div class="empty-state"><i class="bi bi-house-exclamation"></i>Your tenancy details are not available. Please contact your property team.</div>';
    return;
  }

  const rents = data.rentSchedule.filter((rent) => rent.tenantId === tenant.id)
    .map((rent) => ({ ...rent, currentStatus: getRentStatus(rent, data.config) }))
    .filter((rent) => rent.currentStatus !== 'paid')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nextRent = rents[0];
  const overdueRents = rents.filter((rent) => rent.currentStatus === 'overdue');
  const openIssues = data.issues.filter((issue) => issue.tenantId === tenant.id && !['resolved', 'closed'].includes(issue.status)).length;
  const notifications = data.notifications.filter((item) =>
    item.audience === 'tenant' && (!item.userId || item.userId === tenant.userId)
  ).sort((a, b) => b.createdOn.localeCompare(a.createdOn)).slice(0, 3);

  const nextRentCard = nextRent
    ? (() => {
      const daysLeft = daysBetween(data.config.demoToday, nextRent.dueDate);
      const overdue = nextRent.currentStatus === 'overdue';
      const dueCopy = overdue
        ? `${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'day' : 'days'} overdue`
        : daysLeft === 0 ? 'Due today' : `Due in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;
      return `<section class="rent-card" aria-labelledby="rentDueHeading">
        <div class="d-flex align-items-center justify-content-between gap-2"><span class="rent-label" id="rentDueHeading">${overdue ? 'Rent needs your attention' : 'Your next rent'}</span><span class="badge rounded-pill ${overdue ? 'text-bg-danger' : 'text-bg-light'}">${overdue ? 'Overdue' : 'Upcoming'}</span></div>
        <div class="rent-amount">${formatCurrency(Number(nextRent.amount) - Number(nextRent.paidAmount || 0), data.config)}</div>
        <div class="rent-meta mb-3">${overdue ? 'Was due' : 'Due'} ${formatDate(nextRent.dueDate)} · ${escapeHtml(dueCopy)}</div>
        ${routeButton('/payments', 'Pay rent', 'bi-arrow-up-right', 'btn btn-light w-100')}
      </section>`;
    })()
    : `<section class="tenant-card text-center"><span class="status-pill"><i class="bi bi-check-circle"></i>All up to date</span><p class="small text-secondary mt-2 mb-0">There are no unpaid rent items at the moment.</p></section>`;

  container.innerHTML = `<div class="page-enter">
    <p class="tenant-greeting">Welcome back</p>
    <h1 class="tenant-home-heading mb-3">${escapeHtml(tenant.name.split(' ')[0])} <i class="bi bi-hand-wave text-success" aria-hidden="true"></i></h1>
    ${overdueRents.length ? `<div class="overdue-banner" role="alert"><i class="bi bi-exclamation-circle-fill mt-1"></i><span><strong>Rent overdue</strong><br>You have ${overdueRents.length} unpaid rent ${overdueRents.length === 1 ? 'payment' : 'payments'}. Please review your payments.</span></div>` : ''}
    ${nextRentCard}
    <h2 class="home-section-heading">Quick actions</h2>
    <div class="shortcut-grid" aria-label="Quick actions">
      ${routeButton('/payments', 'Pay rent', 'bi-credit-card', 'shortcut-button')}
      ${routeButton('/issues', 'Report issue', 'bi-tools', 'shortcut-button')}
      ${routeButton('/documents', 'Upload document', 'bi-cloud-arrow-up', 'shortcut-button')}
      ${routeButton('/contracts', 'Contracts', 'bi-file-earmark-text', 'shortcut-button')}
    </div>
    <div class="home-section-heading"><h2 class="m-0 fs-6 fw-bold">Your tenancy</h2><span class="status-pill">${escapeHtml(tenant.status)}</span></div>
    <section class="tenant-card">
      <div class="d-flex gap-2 align-items-start mb-3"><span class="notification-icon"><i class="bi bi-house-door"></i></span><div><strong class="d-block fs-6">${escapeHtml(property.name)}</strong><span class="small text-secondary">${escapeHtml(property.address)}, ${escapeHtml(property.postcode)}</span></div></div>
      <div class="summary-list">
        <div class="summary-item"><span class="summary-label">Monthly rent</span><span class="summary-value">${formatCurrency(Number(property.monthlyRent), data.config)}</span></div>
        <div class="summary-item"><span class="summary-label">Rent due day</span><span class="summary-value">${tenant.rentDueDay}${tenant.rentDueDay % 100 >= 11 && tenant.rentDueDay % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[tenant.rentDueDay % 10] || 'th')} of each month</span></div>
        <div class="summary-item"><span class="summary-label">Tenancy dates</span><span class="summary-value">${formatDate(tenant.tenancyStart)} – ${formatDate(tenant.tenancyEnd)}</span></div>
        <div class="summary-item"><span class="summary-label">Deposit</span><span class="summary-value">${formatCurrency(Number(property.deposit), data.config)} · ${escapeHtml(property.depositScheme)}</span></div>
      </div>
      <p class="small text-secondary mt-3 mb-0">Deposit reference: ${escapeHtml(property.depositRef)}</p>
    </section>
    <div class="home-section-heading"><h2 class="m-0 fs-6 fw-bold">Recent updates</h2>${routeButton('/notifications', 'See all', '', 'small text-decoration-none')}</div>
    <section class="tenant-card">${notifications.length ? notifications.map((item) => `<article class="notification-row"><span class="notification-icon"><i class="bi bi-${item.type === 'rent' ? 'cash-stack' : item.type === 'issue' ? 'tools' : item.type === 'contract' ? 'file-earmark-check' : 'bell'}"></i></span><div class="notification-copy"><strong>${escapeHtml(item.title)}${item.read ? '' : ' · New'}</strong><p>${escapeHtml(item.body)}</p><p>${formatDate(item.createdOn)}</p></div></article>`).join('') : '<div class="empty-state"><i class="bi bi-bell-slash"></i>No recent updates.</div>'}</section>
    <div class="d-flex justify-content-between align-items-center mt-3 px-1 small text-secondary"><span><i class="bi bi-tools me-1"></i>${openIssues} open ${openIssues === 1 ? 'issue' : 'issues'}</span><span>Demo date · ${formatDate(data.config.demoToday)}</span></div>
  </div>`;
}
