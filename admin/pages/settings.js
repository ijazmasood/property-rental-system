import { resetDemo } from '../../data/store.js';
import { FEATURES } from '../components/needs-live-system.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function addAudit(context, action, entity, detail) {
  context.save('auditLog', [...context.data.auditLog, {
    id: makeId('audit'),
    date: `${context.data.config.demoToday}T12:00:00`,
    userName: context.role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
    action,
    entity,
    detail
  }]);
}

export function renderSettings(container, context) {
  const company = context.data.config.companyDetails || {};
  container.innerHTML = `<div class="page-header"><div><p class="page-eyebrow">Administration</p><h1 class="page-title">Settings</h1><p class="page-subtitle">Demo configuration, reminder rules, and backend feature availability.</p></div></div>
    <div class="d-flex flex-wrap gap-2 mb-3"><a class="btn btn-forest btn-sm" href="#/settings">General settings</a><a class="btn btn-light border btn-sm" href="#/settings/about">About this demo</a></div>
    <section class="panel-card mb-3"><div class="mb-3"><h2 class="h6 fw-bold mb-1">Company details and demo date</h2><p class="small text-secondary mb-0">The demo date drives all due, overdue and expiry calculations.</p></div>
      <form id="settingsForm"><div class="row g-3">
        <div class="col-md-6"><label class="form-label" for="companyName">Company name</label><input class="form-control" id="companyName" name="companyName" maxlength="100" value="${escapeHtml(company.name || 'Landlord Desk Property Management')}" required></div>
        <div class="col-md-6"><label class="form-label" for="companyEmail">Contact email</label><input class="form-control" id="companyEmail" name="companyEmail" type="email" maxlength="160" value="${escapeHtml(company.email || 'hello@landlorddesk.example')}" required></div>
        <div class="col-md-6"><label class="form-label" for="demoToday">Demo today</label><input class="form-control" id="demoToday" name="demoToday" type="date" value="${escapeHtml(context.data.config.demoToday)}" required><div class="form-text">Status changes will be recalculated when this date is updated.</div></div>
        <div class="col-md-6"><label class="form-label" for="rentReminder">Rent reminder days before due</label><input class="form-control" id="rentReminder" name="rentReminderDaysBefore" type="number" min="0" max="60" value="${escapeHtml(context.data.config.rentReminderDaysBefore)}" required></div>
        <div class="col-12"><label class="form-label" for="reminderDays">Document reminder days before expiry</label><input class="form-control" id="reminderDays" name="reminderDays" value="${escapeHtml((context.data.config.reminderDays || []).join(', '))}" pattern="\\s*\\d+(?:\\s*,\\s*\\d+)*\\s*" required><div class="form-text">Comma-separated day offsets, for example 60, 30, 7.</div></div>
      </div>${context.role !== 'accountant' ? '<button class="btn btn-forest mt-3" type="submit">Save settings</button>' : '<p class="small text-secondary mt-3 mb-0">Read-only access.</p>'}</form>
    </section>
    <section class="panel-card mb-3"><div class="mb-3"><h2 class="h6 fw-bold mb-1">Feature flags</h2><p class="small text-secondary mb-0">Backend-dependent services are not connected in this static sample.</p></div><div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Feature</th><th>Flag</th><th>Status</th></tr></thead><tbody>${Object.entries(context.data.config.features || {}).map(([name, enabled]) => `<tr><td>${escapeHtml(name)}</td><td><span class="badge ${enabled ? 'text-bg-success' : 'bg-light text-secondary'}">${enabled ? 'Enabled' : 'Disabled'}</span></td><td>Available when backend is connected</td></tr>`).join('')}</tbody></table></div></section>
    <section class="panel-card border-danger-subtle"><div class="d-flex flex-wrap align-items-center justify-content-between gap-3"><div><h2 class="h6 fw-bold mb-1 text-danger">Reset demo data</h2><p class="small text-secondary mb-0">Clears browser changes and restores the original sample records on this device, including its audit overlay.</p></div>${context.role !== 'accountant' ? '<button class="btn btn-outline-danger" data-action="reset-demo">Reset demo data</button>' : '<span class="small text-secondary">Only an administrator can reset demo data.</span>'}</div></section>`;
  if (context.role !== 'accountant') {
    container.querySelector('#settingsForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const values = new FormData(form);
      const reminderDays = values.get('reminderDays').split(',').map((value) => Number(value.trim()));
      if (!reminderDays.length || reminderDays.some((day) => !Number.isInteger(day) || day < 0 || day > 365)) {
        context.toast('Reminder days must be whole numbers between 0 and 365.', 'error');
        return;
      }
      const nextConfig = {
        ...context.data.config,
        demoToday: values.get('demoToday'),
        reminderDays: [...new Set(reminderDays)].sort((a, b) => b - a),
        rentReminderDaysBefore: Number(values.get('rentReminderDaysBefore')),
        companyDetails: {
          name: values.get('companyName').trim(),
          email: values.get('companyEmail').trim()
        }
      };
      try {
        // These store writes become the configuration and audit API calls when a backend is introduced.
        context.save('config', nextConfig);
        addAudit(context, 'Updated', 'Settings', `Company details, demoToday (${nextConfig.demoToday}) and reminder rules updated.`);
        context.refresh();
        context.toast('Settings saved');
      } catch (error) {
        context.toast(`Could not save settings: ${error.message}`, 'error');
      }
    });
    container.querySelector('[data-action="reset-demo"]').addEventListener('click', () => {
      if (!window.confirm('Reset all demo changes in this browser and restore the original sample data? This cannot be undone.')) return;
      try {
        // This store operation becomes the backend demo-data reset API call when introduced.
        resetDemo();
        context.toast('Demo data reset to the original sample records');
      } catch (error) {
        context.toast(`Could not reset demo data: ${error.message}`, 'error');
      }
    });
  }
}

const ABOUT_FEATURES = [
  ['authentication', 'Secure login and MFA', 'Backend identity, password recovery, multi-factor authentication and server-enforced role permissions.'],
  ['payments', 'Payment gateway', 'Stripe card or pay-by-bank checkout and GoCardless Direct Debit, with signed server-side webhooks.'],
  ['ai', 'Real AI services', 'Document extraction, bank-match suggestions and portfolio questions using a configured AI service and human confirmation.'],
  ['banking', 'Open Banking / ANNA', 'Consent-based bank connection with encrypted tokens, transaction refresh and revocation.'],
  ['notifications', 'Email, SMS and push delivery', 'Provider-backed delivery, consent management, templates and delivery status tracking.'],
  ['signatures', 'Electronic signatures', 'A signing provider, identity checks and an auditable document approval workflow.'],
  ['storage', 'Secure file storage', 'Encrypted, access-controlled storage for certificates, agreements and invoices.'],
  ['scheduledJobs', 'Scheduled reminders and checks', 'Server-side jobs for rent reminders, overdue detection and compliance expiry alerts.']
];

export function renderAboutDemo(container, context) {
  container.innerHTML = `<div class="page-header"><div><p class="page-eyebrow">Administration</p><h1 class="page-title">About this demo</h1><p class="page-subtitle">What is simulated today and what needs a connected backend.</p></div></div>
    <div class="d-flex flex-wrap gap-2 mb-3"><a class="btn btn-light border btn-sm" href="#/settings">General settings</a><a class="btn btn-forest btn-sm" href="#/settings/about">About this demo</a></div>
    <section class="panel-card"><div class="mb-3"><h2 class="h6 fw-bold mb-1">Backend-dependent features</h2><p class="small text-secondary mb-0">These screens demonstrate the intended user experience only. The status below is the same for every feature.</p></div>
      <div class="row g-3">${ABOUT_FEATURES.map(([key, title, description]) => `<div class="col-lg-6"><article class="h-100 p-3 border rounded-3"><div class="d-flex justify-content-between align-items-start gap-2"><h3 class="h6 fw-bold mb-1">${escapeHtml(title)}</h3><span class="badge text-bg-warning bg-opacity-10 text-warning border border-warning border-opacity-10">Available when backend is connected</span></div><p class="small text-secondary mt-2 mb-3">${escapeHtml(description)}</p><span id="aboutBadge-${escapeHtml(key)}"></span></article></div>`).join('')}</div>
    </section><section class="panel-card mt-3"><h2 class="h6 fw-bold">Demo boundaries</h2><ul class="small text-secondary mb-0"><li class="mb-1">Records are loaded from shared JSON and changed through the local browser overlay.</li><li class="mb-1">AI features only produce suggestions; a person confirms before a record changes.</li><li class="mb-1">Payment records are simulated and do not collect money.</li><li>No real email, push notification, bank feed, signature or secure file upload is sent or connected.</li></ul></section>`;
  for (const [key] of ABOUT_FEATURES) {
    container.querySelector(`#aboutBadge-${CSS.escape(key)}`).replaceWith(context.createNeedsLiveBadge(key, 'Needs live system'));
  }
}
