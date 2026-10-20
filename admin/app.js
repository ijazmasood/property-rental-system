import { CHANGE_EVENT, loadAll, save } from '../data/store.js';
import { formatCurrency } from '../data/helpers/currency.js';
import { daysBetween, formatDate } from '../data/helpers/date.js';
import { getBillStatus, getDocumentStatus, getRentStatus } from '../data/helpers/status.js';
import { createNeedsLiveBadge, initializeNeedsLiveSystemModal } from './components/needs-live-system.js';
import { answerPortfolioQuestion, renderAssistantResponse } from './pages/ai-assistant.js';
import { renderPropertyList, renderPropertyProfile } from './pages/properties.js';
import { renderTenantList, renderTenantProfile } from './pages/tenants.js';
import { renderTenantRequests } from './pages/tenant-requests.js';
import { renderDocuments } from './pages/documents.js';
import { renderRentPayments } from './pages/rent-payments.js';
import { renderBills } from './pages/bills.js';
import { renderAccounts } from './pages/accounts.js';
import { renderBankStatements } from './pages/bank-statements.js';
import { renderIssues } from './pages/issues.js';
import { renderContracts } from './pages/contracts.js';
import { renderNotifications as renderNotificationsPage } from './pages/notifications.js';
import { renderAiAssistant } from './pages/ai-assistant.js';
import { renderReports } from './pages/reports.js';
import { renderUsers } from './pages/users.js';
import { renderAuditLog } from './pages/audit-log.js';
import { renderAboutDemo, renderSettings } from './pages/settings.js';

const ROLE_NAMES = {
  superadmin: 'Super admin',
  admin: 'Admin',
  accountant: 'Accountant'
};

const ROLE_USERS = {
  superadmin: { id: 'u-admin', name: 'Helen Foster', initials: 'HF' },
  admin: { id: 'u-manager', name: 'Martin Cole', initials: 'MC' },
  accountant: { id: 'u-accountant', name: 'Nina Patel', initials: 'NP' }
};

const NAV_ITEMS = [
  { section: 'Portfolio' },
  { label: 'Dashboard', icon: 'bi-grid-1x2', route: '/', roles: ['superadmin', 'admin', 'accountant'] },
  { label: 'Properties', icon: 'bi-buildings', route: '/properties', roles: ['superadmin', 'admin', 'accountant'] },
  { label: 'Tenants', icon: 'bi-people', route: '/tenants', roles: ['superadmin', 'admin', 'accountant'] },
  { label: 'Tenant Requests', icon: 'bi-person-plus', route: '/tenant-requests', roles: ['superadmin', 'admin'], badge: 'requests' },
  { label: 'Documents', icon: 'bi-file-earmark-text', route: '/documents', roles: ['superadmin', 'admin', 'accountant'] },
  { label: 'Rent and Payments', icon: 'bi-cash-coin', route: '/rent-payments', roles: ['superadmin', 'admin', 'accountant'] },
  { label: 'Bills', icon: 'bi-receipt', route: '/bills', roles: ['superadmin', 'admin', 'accountant'] },
  { section: 'Finance' },
  { label: 'Accounts', icon: 'bi-journal-text', route: '/accounts', roles: ['superadmin', 'admin', 'accountant'] },
  { label: 'Bank Statements', icon: 'bi-bank', route: '/bank-statements', roles: ['superadmin', 'admin', 'accountant'] },
  { label: 'Reports', icon: 'bi-bar-chart', route: '/reports', roles: ['superadmin', 'admin', 'accountant'] },
  { section: 'Operations' },
  { label: 'Issues', icon: 'bi-tools', route: '/issues', roles: ['superadmin', 'admin', 'accountant'] },
  { label: 'Contracts', icon: 'bi-file-earmark-check', route: '/contracts', roles: ['superadmin', 'admin', 'accountant'] },
  { label: 'Notifications', icon: 'bi-bell', route: '/notifications', roles: ['superadmin', 'admin', 'accountant'] },
  { label: 'AI Assistant', icon: 'bi-stars', route: '/ai-assistant', roles: ['superadmin', 'admin', 'accountant'] },
  { section: 'Administration' },
  { label: 'Users and Roles', icon: 'bi-person-gear', route: '/users', roles: ['superadmin', 'admin'] },
  { label: 'Audit Log', icon: 'bi-clock-history', route: '/audit-log', roles: ['superadmin', 'admin', 'accountant'] },
  { label: 'Settings', icon: 'bi-sliders', route: '/settings', roles: ['superadmin', 'admin'] }
];

const ROUTE_TITLES = Object.fromEntries(
  NAV_ITEMS.filter((item) => item.route).map((item) => [item.route, item.label])
);

const ICONS = {
  rent: 'bi-cash-stack',
  document: 'bi-file-earmark-excel',
  issue: 'bi-tools',
  request: 'bi-person-plus',
  bill: 'bi-receipt'
};

const STATUS_LABELS = {
  open: 'Open',
  'in progress': 'In progress',
  'awaiting tenant': 'Awaiting tenant',
  resolved: 'Resolved',
  closed: 'Closed'
};

let data;
let currentRole = 'superadmin';
let charts = [];

const mainContent = document.querySelector('#mainContent');
const sidebarNav = document.querySelector('#sidebarNav');
const searchInput = document.querySelector('#globalSearch');
const searchResults = document.querySelector('#searchResults');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function routeForHash() {
  const route = (window.location.hash.replace(/^#/, '') || '/').split('?')[0];
  return route.startsWith('/') ? route : `/${route}`;
}

function showToast(message, tone = 'success') {
  const id = `toast-${Date.now()}`;
  const icon = tone === 'success' ? 'bi-check-circle-fill' : tone === 'error' ? 'bi-exclamation-circle-fill' : 'bi-info-circle-fill';
  const background = tone === 'success' ? 'text-bg-success' : tone === 'error' ? 'text-bg-danger' : 'text-bg-secondary';
  document.querySelector('#toastContainer').insertAdjacentHTML('beforeend', `
    <div class="toast ${background} border-0" id="${id}" role="status" aria-live="polite" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body"><i class="bi ${icon} me-2"></i>${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>`);
  const toast = document.querySelector(`#${id}`);
  toast.addEventListener('hidden.bs.toast', () => toast.remove());
  window.bootstrap.Toast.getOrCreateInstance(toast, { delay: 2600 }).show();
}

function renderNavigation() {
  let links = '';
  for (const item of NAV_ITEMS) {
    if (item.section) {
      links += `<div class="nav-section-label">${escapeHtml(item.section)}</div>`;
      continue;
    }
    if (!item.roles.includes(currentRole)) continue;
    const active = isRouteActive(item.route, routeForHash());
    const count = item.badge === 'requests'
      ? data.tenantRequests.filter((request) => request.status === 'pending').length
      : 0;
    links += `
      <a class="sidebar-link${active ? ' active' : ''}" href="#${item.route}"${active ? ' aria-current="page"' : ''} title="${escapeHtml(item.label)}">
        <i class="bi ${item.icon}" aria-hidden="true"></i><span class="nav-label">${escapeHtml(item.label)}</span>
        ${count ? `<span class="badge rounded-pill text-bg-light ms-auto">${count}</span>` : ''}
      </a>`;
  }
  sidebarNav.innerHTML = links;
}

function isRouteActive(itemRoute, route) {
  if (itemRoute === '/') return route === '/';
  return route === itemRoute || route.startsWith(`${itemRoute}/`);
}

function updateUserMenu() {
  const user = data.users.find((item) => item.id === ROLE_USERS[currentRole].id)
    || ROLE_USERS[currentRole];
  const initials = user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  document.querySelector('#topbarAvatar').textContent = initials;
  document.querySelector('#topbarName').textContent = user.name;
  document.querySelector('#topbarRole').textContent = ROLE_NAMES[currentRole];
  document.querySelector('#sidebarAvatar').textContent = initials;
  document.querySelector('#sidebarName').textContent = user.name;
  document.querySelector('#sidebarRole').textContent = ROLE_NAMES[currentRole];
  document.querySelector('#profileAvatar').textContent = initials;
  document.querySelector('#profileName').textContent = user.name;
  document.querySelector('#profileRole').textContent = ROLE_NAMES[currentRole];
  document.querySelector('#profileEmail').textContent = user.email || 'Not available';
  document.querySelector('#profilePhone').textContent = user.phone || 'Not available';
  document.querySelector('#profileStatus').textContent = user.status || 'Demo account';
  document.querySelector('#roleSwitcher').value = currentRole;
  renderNavigation();
  renderNotifications();
}

function openUserProfile() {
  window.bootstrap.Modal.getOrCreateInstance(
    document.querySelector('#adminProfileModal')
  ).show();
}

function signOut() {
  window.location.assign('../index.html');
}

function renderNotifications() {
  const unread = data.notifications.filter((notification) =>
    notification.audience === 'admin' && !notification.read
  );
  document.querySelector('#unreadBadge').classList.toggle('d-none', unread.length === 0);
  const notificationList = document.querySelector('#notificationList');
  if (!unread.length) {
    notificationList.innerHTML = '<div class="notification-empty">You’re all caught up.</div>';
    return;
  }

  notificationList.innerHTML = unread.slice(0, 5).map((notification) => `
    <div class="notification-item">
      <div class="notification-title">${escapeHtml(notification.title)}</div>
      <p>${escapeHtml(notification.body)}</p>
      <p>${escapeHtml(formatDate(notification.createdOn))}</p>
    </div>`).join('');
}

function monthEntries(config) {
  const today = new Date(`${config.demoToday}T00:00:00`);
  const entries = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    entries.push({
      key,
      label: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(monthDate)
    });
  }
  return entries;
}

function totalsByMonth(rows, monthList, dateField, valueForRow) {
  return monthList.map(({ key }) => rows
    .filter((row) => row[dateField]?.startsWith(key))
    .reduce((total, row) => total + valueForRow(row), 0));
}

function getDashboardMetrics() {
  const { config } = data;
  const thisMonth = config.demoToday.slice(0, 7);
  const monthlyRent = data.rentSchedule.filter((rent) => rent.dueDate.startsWith(thisMonth));
  const documents = data.documents.map((document) => ({
    ...document,
    computedStatus: getDocumentStatus(document, config)
  }));
  const rent = data.rentSchedule.map((item) => ({
    ...item,
    computedStatus: getRentStatus(item, config)
  }));
  const bills = data.bills.map((item) => ({
    ...item,
    computedStatus: getBillStatus(item, config)
  }));
  const occupied = data.properties.filter((property) => property.status === 'occupied').length;
  const collected = data.payments
    .filter((payment) => payment.date.startsWith(thisMonth))
    .reduce((sum, payment) => sum + payment.amount, 0);
  const overdue = rent.filter((item) => item.computedStatus === 'overdue');
  const overdueAmount = overdue.reduce((sum, item) => sum + Math.max(0, item.amount - (item.paidAmount || 0)), 0);
  const expiringDocuments = documents.filter((document) =>
    document.computedStatus === 'expired' || document.computedStatus === 'expiring'
  );
  const openIssues = data.issues.filter((issue) =>
    !['resolved', 'closed'].includes(issue.status)
  );

  return {
    thisMonth,
    monthlyRent,
    expected: monthlyRent.reduce((sum, item) => sum + item.amount, 0),
    collected,
    overdue,
    overdueAmount,
    expiringDocuments,
    openIssues,
    occupied,
    vacant: data.properties.length - occupied,
    rent,
    bills
  };
}

function buildAttentionItems(metrics) {
  const propertiesById = new Map(data.properties.map((property) => [property.id, property]));
  const tenantsById = new Map(data.tenants.map((tenant) => [tenant.id, tenant]));
  const documentTypesById = new Map(data.documentTypes.map((type) => [type.id, type.name]));
  const items = [];

  for (const rent of metrics.rent.filter((item) => item.computedStatus === 'overdue')) {
    const tenant = tenantsById.get(rent.tenantId);
    const property = propertiesById.get(rent.propertyId);
    items.push({
      rank: 0,
      dateRank: daysBetween(data.config.demoToday, rent.dueDate),
      type: 'rent',
      title: `${tenant?.name || 'Tenant'} — overdue rent`,
      subtitle: `${property?.name || 'Property'} · ${formatCurrency(rent.amount - (rent.paidAmount || 0), data.config)} · due ${formatDate(rent.dueDate)}`,
      route: '/rent-payments',
      action: 'Review rent',
      urgent: true
    });
  }

  for (const document of metrics.expiringDocuments) {
    const property = propertiesById.get(document.propertyId);
    const expired = document.computedStatus === 'expired';
    items.push({
      rank: expired ? 1 : 3,
      dateRank: daysBetween(data.config.demoToday, document.expiryDate),
      type: 'document',
      title: `${documentTypesById.get(document.type) || document.type.replaceAll('-', ' ')} ${expired ? 'has expired' : 'expires soon'}`,
      subtitle: `${property?.name || 'Property'} · ${expired ? `expired ${formatDate(document.expiryDate)}` : `expires ${formatDate(document.expiryDate)}`}`,
      route: '/documents',
      action: 'View document',
      urgent: expired
    });
  }

  for (const issue of metrics.openIssues.filter((item) => item.priority === 'urgent')) {
    const property = propertiesById.get(issue.propertyId);
    items.push({
      rank: 2,
      dateRank: daysBetween(issue.createdOn, data.config.demoToday),
      type: 'issue',
      title: issue.title,
      subtitle: `${property?.name || 'Property'} · urgent repair`,
      route: '/issues',
      action: 'View issue',
      urgent: true
    });
  }

  for (const request of data.tenantRequests.filter((item) => item.status === 'pending')) {
    const property = propertiesById.get(request.propertyId);
    items.push({
      rank: 5,
      dateRank: daysBetween(request.requestedOn, data.config.demoToday),
      type: 'request',
      title: `${request.name} — tenant request`,
      subtitle: `${property?.name || 'Property'} · received ${formatDate(request.requestedOn)}`,
      route: '/tenant-requests',
      action: 'Review request',
      urgent: false
    });
  }

  for (const bill of metrics.bills.filter((item) => item.computedStatus !== 'paid')) {
    const property = propertiesById.get(bill.propertyId);
    const overdue = bill.computedStatus === 'overdue';
    items.push({
      rank: overdue ? 3 : 6,
      dateRank: daysBetween(data.config.demoToday, bill.dueDate),
      type: 'bill',
      title: `${bill.supplier} — ${overdue ? 'bill overdue' : 'bill due'}`,
      subtitle: `${property?.name || 'Property'} · ${formatCurrency(bill.amount, data.config)} · due ${formatDate(bill.dueDate)}`,
      route: '/bills',
      action: 'View bill',
      urgent: overdue
    });
  }

  return items.sort((first, second) => first.rank - second.rank || first.dateRank - second.dateRank);
}

function statCard(label, value, icon, hint, tone = '') {
  return `
    <div class="col-6 col-xl-3">
      <article class="stat-card">
        <div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon"><i class="bi ${icon}" aria-hidden="true"></i></span></div>
        <div class="stat-value ${tone}">${value}</div>
        <div class="stat-hint">${hint}</div>
      </article>
    </div>`;
}

function renderDashboard() {
  const metrics = getDashboardMetrics();
  const attentionItems = buildAttentionItems(metrics);
  const config = data.config;
  const dayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date(`${config.demoToday}T00:00:00`));

  mainContent.innerHTML = `
    <div class="page-header">
      <div>
        <p class="page-eyebrow">${escapeHtml(dayLabel)}, ${escapeHtml(formatDate(config.demoToday))} <span class="mx-1">·</span> Portfolio overview</p>
        <h1 class="page-title">Good morning, ${escapeHtml(ROLE_USERS[currentRole].name.split(' ')[0])}</h1>
        <p class="page-subtitle">Here’s what’s happening across your properties today.</p>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="small text-secondary d-none d-md-inline">${data.properties.length} properties</span>
        <button class="btn btn-light border btn-sm" id="refreshDashboard" type="button"><i class="bi bi-arrow-clockwise me-1"></i>Refresh</button>
      </div>
    </div>

    <section class="row g-3 mb-3" aria-label="Portfolio summary">
      ${statCard('Total properties', String(data.properties.length), 'bi-buildings', `<span class="positive">${metrics.occupied} occupied</span> · ${metrics.vacant} vacant`)}
      ${statCard('Rent due this month', formatCurrency(metrics.expected, config), 'bi-calendar2-check', `${metrics.monthlyRent.length} scheduled rent payments`)}
      ${statCard('Rent collected', formatCurrency(metrics.collected, config), 'bi-wallet2', 'Payments received this month', 'text-success')}
      ${statCard('Overdue rent', formatCurrency(metrics.overdueAmount, config), 'bi-exclamation-circle', `${metrics.overdue.length} overdue ${metrics.overdue.length === 1 ? 'payment' : 'payments'}`, 'text-danger')}
      ${statCard('Compliance documents', String(metrics.expiringDocuments.length), 'bi-file-earmark-medical', `${metrics.expiringDocuments.filter((item) => item.computedStatus === 'expired').length} expired · ${metrics.expiringDocuments.filter((item) => item.computedStatus === 'expiring').length} expiring`, 'text-warning')}
      ${statCard('Open issues', String(metrics.openIssues.length), 'bi-tools', `${metrics.openIssues.filter((item) => item.priority === 'urgent').length} urgent across the portfolio`)}
    </section>

    <section class="row g-3 mb-3" aria-label="Portfolio trends">
      <div class="col-xl-7">
        <article class="chart-card">
          <div class="panel-header"><div><h2 class="panel-title">Rent collected vs expected</h2><p class="panel-caption">Monthly totals · last six months</p></div><span class="small text-secondary">GBP</span></div>
          <div class="chart-wrap"><canvas id="rentChart" role="img" aria-label="Bar chart comparing monthly rent collected and expected"></canvas></div>
        </article>
      </div>
      <div class="col-xl-5">
        <article class="chart-card">
          <div class="panel-header"><div><h2 class="panel-title">Income and expenses</h2><p class="panel-caption">Ledger activity · last six months</p></div><span class="small text-secondary">GBP</span></div>
          <div class="chart-wrap"><canvas id="financeChart" role="img" aria-label="Line chart comparing monthly income and expenses"></canvas></div>
        </article>
      </div>
    </section>

    <section class="row g-3">
      <div class="col-xl-5">
        <article class="chart-card">
          <div class="panel-header"><div><h2 class="panel-title">Issues by status</h2><p class="panel-caption">Current maintenance workload</p></div><a class="small text-decoration-none" href="#/issues">View issues <i class="bi bi-arrow-right"></i></a></div>
          <div class="chart-wrap chart-small"><canvas id="issuesChart" role="img" aria-label="Doughnut chart showing issues by status"></canvas></div>
        </article>
      </div>
      <div class="col-xl-7">
        <article class="panel-card h-100">
          <div class="panel-header">
            <div><h2 class="panel-title">Needs attention</h2><p class="panel-caption">Items that may need a follow-up</p></div>
            <span class="attention-count">${attentionItems.length} items</span>
          </div>
          <div class="attention-list" id="attentionList">
            ${attentionItems.length ? attentionItems.map(renderAttentionItem).join('') : '<div class="empty-state"><i class="bi bi-check2-circle"></i>No items need attention right now.</div>'}
          </div>
        </article>
      </div>
    </section>

    <div class="d-flex align-items-center justify-content-between mt-3 pt-1 small text-secondary">
      <span>Demo data · Statuses calculated from ${escapeHtml(formatDate(config.demoToday))}</span>
      <div class="d-flex align-items-center gap-2"><span>Scheduled checks</span><span id="scheduledJobsBadge"></span></div>
    </div>`;

  mainContent.querySelector('#scheduledJobsBadge').replaceWith(createNeedsLiveBadge('scheduledJobs'));
  initializeCharts(metrics);
  mainContent.querySelector('#refreshDashboard').addEventListener('click', () => {
    renderRoute();
    showToast('Dashboard refreshed');
  });
}

function renderAttentionItem(item) {
  const icon = ICONS[item.type] || 'bi-exclamation-circle';
  const urgencyClass = item.urgent ? ' urgent' : item.type === 'request' ? ' info' : '';
  return `
    <div class="attention-item" data-attention-search="${escapeHtml(`${item.title} ${item.subtitle}`.toLowerCase())}">
      <span class="attention-icon${urgencyClass}"><i class="bi ${icon}" aria-hidden="true"></i></span>
      <div class="attention-copy"><div class="attention-title">${escapeHtml(item.title)}</div><div class="attention-subtitle">${escapeHtml(item.subtitle)}</div></div>
      <a class="attention-action text-decoration-none" href="#${item.route}">${escapeHtml(item.action)} <i class="bi bi-arrow-right-short"></i></a>
    </div>`;
}

function initializeCharts(metrics) {
  charts.forEach((chart) => chart.destroy());
  charts = [];
  if (!window.Chart) {
    console.error('Chart.js did not load. Dashboard charts are unavailable.');
    return;
  }

  const months = monthEntries(data.config);
  const rentExpected = totalsByMonth(data.rentSchedule, months, 'dueDate', (rent) => rent.amount);
  const rentCollected = totalsByMonth(data.payments, months, 'date', (payment) => payment.amount);
  const accountsById = new Map(data.accounts.map((account) => [account.id, account]));
  const income = months.map(({ key }) => data.ledger
    .filter((entry) => entry.date.startsWith(key) && accountsById.get(entry.accountId)?.type === 'Income')
    .reduce((total, entry) => total + entry.credit, 0));
  const expenses = months.map(({ key }) => data.ledger
    .filter((entry) => entry.date.startsWith(key) && accountsById.get(entry.accountId)?.type === 'Expense')
    .reduce((total, entry) => total + entry.debit, 0));
  const issueBuckets = ['open', 'in progress', 'awaiting tenant', 'resolved'];
  const issueCounts = issueBuckets.map((status) => data.issues.filter((issue) =>
    status === 'resolved' ? ['resolved', 'closed'].includes(issue.status) : issue.status === status
  ).length);
  const numberFormat = (value) => new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: data.config.currency || 'GBP',
    maximumFractionDigits: 0
  }).format(value);
  const axisOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 7, padding: 18, color: '#718078', font: { size: 11 } } },
      tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${numberFormat(context.parsed.y ?? context.parsed)}` } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#829087', font: { size: 11 } } },
      y: { beginAtZero: true, grid: { color: '#eef1ee' }, ticks: { color: '#829087', font: { size: 10 }, callback: numberFormat } }
    }
  };

  charts.push(new window.Chart(document.querySelector('#rentChart'), {
    type: 'bar',
    data: {
      labels: months.map((month) => month.label),
      datasets: [
        { label: 'Collected', data: rentCollected, backgroundColor: '#2f7b5a', borderRadius: 5, maxBarThickness: 23 },
        { label: 'Expected', data: rentExpected, backgroundColor: '#dce8e0', borderRadius: 5, maxBarThickness: 23 }
      ]
    },
    options: axisOptions
  }));
  charts.push(new window.Chart(document.querySelector('#financeChart'), {
    type: 'line',
    data: {
      labels: months.map((month) => month.label),
      datasets: [
        { label: 'Income', data: income, borderColor: '#2f7b5a', backgroundColor: '#2f7b5a', tension: .35, pointRadius: 3 },
        { label: 'Expenses', data: expenses, borderColor: '#d69043', backgroundColor: '#d69043', tension: .35, pointRadius: 3 }
      ]
    },
    options: axisOptions
  }));
  charts.push(new window.Chart(document.querySelector('#issuesChart'), {
    type: 'doughnut',
    data: {
      labels: ['Open', 'In progress', 'Awaiting tenant', 'Resolved / closed'],
      datasets: [{ data: issueCounts, backgroundColor: ['#d86c5d', '#d9a44f', '#7695bb', '#57a17a'], borderWidth: 0, hoverOffset: 5 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 7, padding: 15, color: '#718078', font: { size: 10 } } } }
    }
  }));
}

function renderPlaceholder(route) {
  const item = NAV_ITEMS.find((navItem) => navItem.route === route);
  const title = item?.label || 'Property profile';
  const icon = item?.icon || 'bi-buildings';
  mainContent.innerHTML = `
    <div class="placeholder-page">
      <span class="placeholder-icon"><i class="bi ${icon}" aria-hidden="true"></i></span>
      <p class="small text-uppercase text-secondary fw-semibold mt-3 mb-1">Admin workspace</p>
      <h1 class="h3 fw-bold">${escapeHtml(title)}</h1>
      <p class="text-secondary mb-3">This screen is scheduled for a later build step. The dashboard and shared admin shell are ready to use.</p>
      <a class="btn btn-forest btn-sm" href="#/"><i class="bi bi-arrow-left me-1"></i>Back to dashboard</a>
    </div>`;
}

function renderRoute() {
  if (!data) return;
  const route = routeForHash();
  renderNavigation();
  if (route === '/') {
    renderDashboard();
  } else if (route === '/properties') {
    destroyCharts();
    renderPropertyList(mainContent, createPageContext());
  } else if (route.startsWith('/properties/')) {
    destroyCharts();
    const propertyId = decodeRouteId(route.slice('/properties/'.length));
    const query = window.location.hash.split('?')[1] || '';
    renderPropertyProfile(mainContent, createPageContext(), propertyId, new URLSearchParams(query).get('tab') || 'overview');
  } else if (route === '/tenants') {
    destroyCharts();
    renderTenantList(mainContent, createPageContext());
  } else if (route.startsWith('/tenants/')) {
    destroyCharts();
    renderTenantProfile(mainContent, createPageContext(), decodeRouteId(route.slice('/tenants/'.length)));
  } else if (route === '/tenant-requests') {
    destroyCharts();
    renderTenantRequests(mainContent, createPageContext());
  } else if (route === '/documents') {
    destroyCharts();
    renderDocuments(mainContent, createPageContext());
  } else if (route === '/rent-payments') {
    destroyCharts();
    renderRentPayments(mainContent, createPageContext());
  } else if (route === '/bills') {
    destroyCharts();
    renderBills(mainContent, createPageContext());
  } else if (route === '/accounts') {
    destroyCharts();
    renderAccounts(mainContent, createPageContext());
  } else if (route === '/bank-statements') {
    destroyCharts();
    renderBankStatements(mainContent, createPageContext());
  } else if (route === '/issues') {
    destroyCharts();
    renderIssues(mainContent, createPageContext());
  } else if (route === '/contracts') {
    destroyCharts();
    renderContracts(mainContent, createPageContext());
  } else if (route === '/notifications') {
    destroyCharts();
    renderNotificationsPage(mainContent, createPageContext());
  } else if (route === '/ai-assistant') {
    destroyCharts();
    renderAiAssistant(mainContent, createPageContext());
  } else if (route === '/reports') {
    destroyCharts();
    renderReports(mainContent, createPageContext());
  } else if (route === '/users') {
    destroyCharts();
    renderUsers(mainContent, createPageContext());
  } else if (route === '/audit-log') {
    destroyCharts();
    renderAuditLog(mainContent, createPageContext());
  } else if (route === '/settings') {
    destroyCharts();
    renderSettings(mainContent, createPageContext());
  } else if (route === '/settings/about') {
    destroyCharts();
    renderAboutDemo(mainContent, createPageContext());
  } else {
    destroyCharts();
    renderPlaceholder(route);
  }
  mainContent.focus({ preventScroll: true });
}

function decodeRouteId(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    console.error('Invalid route identifier:', error);
    return '';
  }
}

function destroyCharts() {
  charts.forEach((chart) => chart.destroy());
  charts = [];
}

function createPageContext() {
  return {
    data,
    role: currentRole,
    createNeedsLiveBadge,
    save,
    toast: showToast,
    refresh: async () => {
      data = await loadAll();
      updateUserMenu();
      renderRoute();
    }
  };
}

function buildSearchIndex() {
  const properties = data.properties.map((property) => ({
    title: property.name,
    detail: `${property.address} · ${property.postcode}`,
    icon: 'bi-buildings',
    route: `/properties/${property.id}`,
    search: `${property.name} ${property.address} ${property.postcode}`
  }));
  const tenants = data.tenants.map((tenant) => ({
    title: tenant.name,
    detail: data.properties.find((property) => property.id === tenant.propertyId)?.name || 'Tenant',
    icon: 'bi-person',
    route: `/tenants/${tenant.id}`,
    search: `${tenant.name} ${tenant.email} ${tenant.phone}`
  }));
  const issues = data.issues.map((issue) => ({
    title: issue.title,
    detail: `${issue.priority} priority · ${STATUS_LABELS[issue.status] || issue.status}`,
    icon: 'bi-tools',
    route: '/issues',
    search: `${issue.title} ${issue.description} ${issue.category}`
  }));
  return [...properties, ...tenants, ...issues];
}

function closeSearch() {
  searchResults.classList.add('d-none');
  searchInput.setAttribute('aria-expanded', 'false');
}

function renderSearchResults(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    closeSearch();
    searchResults.innerHTML = '';
    return;
  }

  const matches = buildSearchIndex()
    .filter((item) => item.search.toLowerCase().includes(normalized))
    .slice(0, 7);
  searchResults.innerHTML = matches.length
    ? matches.map((item, index) => `
      <button type="button" class="search-result" role="option" data-search-route="${escapeHtml(item.route)}" data-search-index="${index}">
        <i class="bi ${item.icon}" aria-hidden="true"></i><span>${escapeHtml(item.title)}<small>${escapeHtml(item.detail)}</small></span>
      </button>`).join('')
    : '<div class="search-empty">No matching properties, tenants or issues.</div>';
  searchResults.classList.remove('d-none');
  searchInput.setAttribute('aria-expanded', 'true');
}

function attachShellEvents() {
  document.querySelector('#roleSwitcher').addEventListener('change', (event) => {
    currentRole = event.target.value;
    updateUserMenu();
    renderRoute();
    showToast(`Switched to ${ROLE_NAMES[currentRole]} demo view`);
  });

  document.querySelector('#collapseSidebar').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
    const collapsed = document.body.classList.contains('sidebar-collapsed');
    document.querySelector('#collapseSidebar').setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    document.querySelector('#collapseSidebar').title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  });

  document.querySelector('#profileMenuButton').addEventListener('click', openUserProfile);
  document.querySelector('#sidebarProfileButton').addEventListener('click', openUserProfile);
  document.querySelector('#signOutButton').addEventListener('click', signOut);
  document.querySelector('#profileSignOutButton').addEventListener('click', signOut);

  const aiPanel = document.querySelector('#adminAiPanel');
  const aiLauncher = document.querySelector('#adminAiLauncher');
  const aiThread = document.querySelector('#adminAiThread');
  const aiForm = document.querySelector('#adminAiForm');
  const closeAiPanel = () => {
    aiPanel.classList.add('d-none');
    aiLauncher.setAttribute('aria-expanded', 'false');
  };
  const askAssistant = (question) => {
    aiThread.insertAdjacentHTML('beforeend', `<article class="chat-message user"><div class="chat-bubble">${escapeHtml(question)}</div></article>${renderAssistantResponse(answerPortfolioQuestion(question, data))}`);
    document.querySelector('#adminAiQuestion').value = '';
    aiThread.scrollTop = aiThread.scrollHeight;
  };
  document.querySelector('#adminAiLiveBadge').append(
    createNeedsLiveBadge('ai', 'Live AI needs live system')
  );
  aiLauncher.addEventListener('click', () => {
    const opening = aiPanel.classList.contains('d-none');
    aiPanel.classList.toggle('d-none', !opening);
    aiLauncher.setAttribute('aria-expanded', String(opening));
    if (opening) document.querySelector('#adminAiQuestion').focus();
  });
  document.querySelector('#adminAiClose').addEventListener('click', closeAiPanel);
  aiForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = document.querySelector('#adminAiQuestion').value.trim();
    if (question && data) askAssistant(question);
  });
  document.querySelector('#adminAiSuggestions').addEventListener('click', (event) => {
    const suggestion = event.target.closest('[data-question]');
    if (suggestion && data) askAssistant(suggestion.dataset.question);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !aiPanel.classList.contains('d-none')) {
      closeAiPanel();
      aiLauncher.focus();
    }
  });

  searchInput.addEventListener('input', () => renderSearchResults(searchInput.value));
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSearch();
    if (event.key === 'Enter') {
      const firstResult = searchResults.querySelector('[data-search-route]');
      if (firstResult) {
        window.location.hash = `#${firstResult.dataset.searchRoute}`;
        closeSearch();
        searchInput.blur();
      }
    }
  });
  searchResults.addEventListener('click', (event) => {
    const result = event.target.closest('[data-search-route]');
    if (!result) return;
    window.location.hash = `#${result.dataset.searchRoute}`;
    closeSearch();
    searchInput.value = '';
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.global-search')) closeSearch();
  });
  document.querySelector('#sidebarNav').addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (link && window.matchMedia('(max-width: 991.98px)').matches) {
      const sidebar = window.bootstrap.Offcanvas.getInstance(document.querySelector('#appSidebar'));
      sidebar?.hide();
    }
  });
  window.addEventListener('hashchange', renderRoute);
  window.addEventListener(CHANGE_EVENT, async () => {
    data = await loadAll();
    updateUserMenu();
    renderRoute();
  });
}

async function start() {
  initializeNeedsLiveSystemModal();
  attachShellEvents();
  try {
    data = await loadAll();
    document.querySelector('#adminAiLauncher').disabled = false;
    updateUserMenu();
    renderRoute();
  } catch (error) {
    console.error('Admin dashboard could not start:', error);
    mainContent.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <h1 class="h5">Dashboard data could not be loaded</h1>
        <p class="mb-0">${escapeHtml(error.message)} Check that you are using a web server and that the shared JSON files are available.</p>
      </div>`;
  }
}

start();
