import { CHANGE_EVENT, loadAll, save } from '../data/store.js';
import { createNeedsLiveBadge, initializeNeedsLiveSystemModal } from '../admin/components/needs-live-system.js';
import { renderContracts } from './pages/contracts.js';
import { renderDocuments } from './pages/documents.js';
import { renderHome } from './pages/home.js';
import { renderIssues } from './pages/issues.js';
import { renderLogin } from './pages/login.js';
import { renderMore } from './pages/more.js';
import { renderNotifications } from './pages/notifications.js';
import { renderPayments } from './pages/payments.js';

const TITLES = {
  '/login': 'Landlord Desk',
  '/home': 'Home',
  '/payments': 'Payments',
  '/issues': 'Issues',
  '/documents': 'Documents',
  '/contracts': 'Contracts',
  '/notifications': 'Notifications',
  '/more': 'More'
};

const app = document.querySelector('#tenantApp');
const phoneScreen = document.querySelector('.phone-screen');
const view = document.querySelector('#tenantView');
const title = document.querySelector('#topbarTitle');
const backButton = document.querySelector('#backButton');
const notificationButton = document.querySelector('#notificationButton');
const notificationCount = document.querySelector('#notificationCount');
const tabs = document.querySelector('#tenantTabs');

let data;
let currentTenantId;
let theme = 'light';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function routeForHash() {
  const route = window.location.hash.replace(/^#/, '').split('?')[0];
  return route || '/login';
}

function getCurrentTenant() {
  return data.tenants.find((tenant) => tenant.id === currentTenantId && tenant.status === 'active');
}

function showToast(message, tone = 'success') {
  const id = `tenant-toast-${Date.now()}`;
  const themeClass = tone === 'error' ? 'text-bg-danger' : tone === 'info' ? 'text-bg-secondary' : 'text-bg-success';
  document.querySelector('#toastContainer').insertAdjacentHTML('beforeend', `<div class="toast ${themeClass} border-0" id="${id}" role="status" aria-live="polite" aria-atomic="true"><div class="d-flex"><div class="toast-body">${escapeHtml(message)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div></div>`);
  const toast = document.querySelector(`#${id}`);
  toast.addEventListener('hidden.bs.toast', () => toast.remove());
  window.bootstrap.Toast.getOrCreateInstance(toast, { delay: 2600 }).show();
}

function setRoute(route) {
  window.location.hash = `#${route}`;
}

function updateShell(route, tenant) {
  app.dataset.theme = theme;
  phoneScreen.dataset.theme = theme;
  document.body.dataset.theme = theme;
  title.textContent = TITLES[route] || 'Landlord Desk';
  backButton.classList.toggle('d-none', !tenant || route === '/home');
  notificationButton.classList.toggle('d-none', !tenant);
  tabs.classList.toggle('d-none', !tenant);
  const unread = tenant
    ? data.notifications.filter((item) => item.audience === 'tenant' && !item.read && (!item.userId || item.userId === tenant.userId)).length
    : 0;
  notificationCount.textContent = unread > 9 ? '9+' : String(unread);
  notificationCount.classList.toggle('d-none', unread === 0);
  for (const tab of tabs.querySelectorAll('.tenant-tab')) {
    const active = tab.dataset.route === route || (route === '/contracts' && tab.dataset.route === '/more');
    tab.classList.toggle('active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
}

function createPageContext(tenant, property) {
  return {
    data,
    tenant,
    property,
    theme,
    toast: showToast,
    save,
    createNeedsLiveBadge,
    refresh: async () => {
      data = await loadAll();
      renderRoute();
    },
    onThemeChange: (nextTheme) => {
      theme = nextTheme;
      app.dataset.theme = theme;
      phoneScreen.dataset.theme = theme;
      document.body.dataset.theme = theme;
      renderRoute();
      showToast(`${theme === 'dark' ? 'Dark' : 'Light'} mode enabled`);
    },
    onLogout: () => {
      currentTenantId = undefined;
      setRoute('/login');
      showToast('You have signed out');
    },
    onLogin: (tenantId) => {
      currentTenantId = tenantId;
      setRoute('/home');
    }
  };
}

function renderRoute() {
  if (!data) return;
  let route = routeForHash();
  let tenant = getCurrentTenant();

  if (route !== '/login' && !tenant) {
    route = '/login';
    setRoute(route);
  }
  if (route === '/login' && tenant) {
    route = '/home';
    setRoute(route);
  }

  updateShell(route, tenant);
  if (route === '/login') {
    renderLogin(view, createPageContext(null, null));
  } else if (!tenant) {
    return;
  } else if (route === '/home') {
    const property = data.properties.find((item) => item.id === tenant.propertyId);
    renderHome(view, createPageContext(tenant, property));
  } else if (route === '/more') {
    const property = data.properties.find((item) => item.id === tenant.propertyId);
    renderMore(view, createPageContext(tenant, property));
  } else if (route === '/payments') {
    const property = data.properties.find((item) => item.id === tenant.propertyId);
    renderPayments(view, createPageContext(tenant, property));
  } else if (route === '/issues') {
    const property = data.properties.find((item) => item.id === tenant.propertyId);
    renderIssues(view, createPageContext(tenant, property));
  } else if (route === '/documents') {
    const property = data.properties.find((item) => item.id === tenant.propertyId);
    renderDocuments(view, createPageContext(tenant, property));
  } else if (route === '/contracts') {
    const property = data.properties.find((item) => item.id === tenant.propertyId);
    renderContracts(view, createPageContext(tenant, property));
  } else if (route === '/notifications') {
    const property = data.properties.find((item) => item.id === tenant.propertyId);
    renderNotifications(view, createPageContext(tenant, property));
  } else {
    setRoute('/home');
  }
}

backButton.addEventListener('click', () => setRoute('/home'));
notificationButton.addEventListener('click', () => setRoute('/notifications'));
window.addEventListener('hashchange', renderRoute);
window.addEventListener(CHANGE_EVENT, async () => {
  try {
    data = await loadAll();
    renderRoute();
  } catch (error) {
    console.error('Tenant app data could not be refreshed:', error);
    showToast(`Could not refresh tenant data: ${error.message}`, 'error');
  }
});

async function start() {
  initializeNeedsLiveSystemModal();
  try {
    data = await loadAll();
    renderRoute();
  } catch (error) {
    console.error('Tenant app could not start:', error);
    view.innerHTML = `<div class="alert alert-danger" role="alert"><h1 class="h5">Tenant app could not load</h1><p class="mb-0">${escapeHtml(error.message)} Check that you are using a web server and that the shared JSON files are available.</p></div>`;
  }
}

start();
