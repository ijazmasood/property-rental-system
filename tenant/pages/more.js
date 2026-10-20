import { resetDemo } from '../../data/store.js';
import { formatCurrency } from '../../data/helpers/currency.js';
import { formatDate } from '../../data/helpers/date.js';
import { auditEntry, escapeHtml, makeId, notificationEntry, openSheet, sheetHeader } from './shared.js';

const DEMO_FEATURES = [
  ['payments', 'Payment gateway and PDF receipts', 'Card, pay-by-bank and Direct Debit checkout plus downloadable PDF receipts.'],
  ['authentication', 'Real login and biometrics', 'Secure accounts, password recovery, device biometrics and server-enforced access.'],
  ['storage', 'Secure file storage', 'Encrypted, access-controlled file uploads for tenant and property documents.'],
  ['signatures', 'Electronic signatures', 'A managed provider for legal agreement signing and identity checks.'],
  ['notifications', 'Push and message delivery', 'Provider-backed push, email and SMS delivery with consent and delivery status.'],
  ['ai', 'Real AI help', 'An AI service that answers from current property and tenancy data.']
];

function renderAbout(context, container) {
  const sheet = openSheet(`${sheetHeader('About this demo', 'Features available when a backend is connected')}
    <div class="tenant-sheet-body"><p class="small text-secondary">This sample stores shared demo changes in this browser. The features below are simulations only.</p>
      ${DEMO_FEATURES.map(([, title]) => `<article class="about-feature-row"><span class="notification-icon"><i class="bi bi-info-circle"></i></span><div><strong>${escapeHtml(title)}</strong><small>Available when backend is connected</small></div></article>`).join('')}
    </div>`);
  sheet.element.querySelectorAll('.about-feature-row').forEach((row, index) => {
    row.prepend(context.createNeedsLiveBadge(DEMO_FEATURES[index][0], 'Needs live system'));
  });
}

function openAiHelp(context) {
  const prompts = ['When is my rent due?', 'How do I report a repair?'];
  const sheet = openSheet(`${sheetHeader('Demo AI help', 'Read-only answers based on your tenancy')}
    <div class="tenant-sheet-body"><span id="tenantAiBadge"></span><div class="ai-chat-thread" id="tenantAiThread" aria-live="polite"></div><div class="d-grid gap-2 mt-3">${prompts.map((prompt, index) => `<button type="button" class="btn btn-light border text-start" data-prompt-index="${index}">${escapeHtml(prompt)}</button>`).join('')}</div>
      <form id="tenantAiForm" class="d-flex gap-2 mt-3"><label class="visually-hidden" for="tenantAiQuestion">Ask a question</label><input class="form-control" id="tenantAiQuestion" maxlength="240" placeholder="Ask about your tenancy" required><button class="btn tenant-btn-primary" type="submit" aria-label="Send question"><i class="bi bi-send"></i></button></form>
    </div>`);
  sheet.element.querySelector('#tenantAiBadge').replaceWith(context.createNeedsLiveBadge('ai', 'Needs live AI'));
  const thread = sheet.element.querySelector('#tenantAiThread');
  const answerQuestion = (question) => {
    const normalized = question.toLowerCase();
    let answer;
    if (/\b(rent|pay|payment|due)\b/.test(normalized)) {
      const nextRent = context.data.rentSchedule.filter((rent) => rent.tenantId === context.tenant.id && rent.status !== 'paid')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      answer = nextRent
        ? `Your next recorded rent item is ${formatCurrency(Number(nextRent.amount) - Number(nextRent.paidAmount || 0), context.data.config)}, due ${formatDate(nextRent.dueDate)}. You can review it in Payments.`
        : 'There are no unpaid rent items in the current demo data.';
    } else if (/\b(issue|repair|broken|maintenance|problem)\b/.test(normalized)) {
      answer = 'Open Issues and choose Report to tell your property team what needs attention. For an emergency, contact the appropriate emergency service or your landlord directly.';
    } else if (/\b(document|certificate|upload|file)\b/.test(normalized)) {
      answer = `Your shared property certificates are listed under Documents for ${context.property.name}. You can add a personal file there; the demo saves its name and metadata only.`;
    } else if (/\b(contract|agreement|sign)\b/.test(normalized)) {
      answer = 'Agreements sent by your landlord appear under Contracts. You can review and record a demo approval there; it is not a legal e-signature.';
    } else {
      answer = 'I can help with rent due dates, reporting repairs, documents and agreements. Ask about one of those topics.';
    }
    thread.insertAdjacentHTML('beforeend', `<div class="ai-chat-message user-message">${escapeHtml(question)}</div><div class="ai-chat-message assistant-message">${escapeHtml(answer)}</div>`);
    thread.scrollTop = thread.scrollHeight;
  };
  sheet.element.querySelectorAll('[data-prompt-index]').forEach((button) => button.addEventListener('click', () => {
    answerQuestion(prompts[Number(button.dataset.promptIndex)]);
  }));
  sheet.element.querySelector('#tenantAiForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = sheet.element.querySelector('#tenantAiQuestion');
    if (!input.value.trim()) return;
    answerQuestion(input.value.trim());
    input.value = '';
  });
}

function saveProfile(container, context) {
  const sheet = openSheet(`${sheetHeader('Edit your details', 'Keep your contact information up to date')}
    <div class="tenant-sheet-body"><form id="tenantProfileForm">
      <div class="mb-3"><label class="form-label small fw-semibold" for="profileName">Full name</label><input class="form-control" id="profileName" name="name" maxlength="100" required value="${escapeHtml(context.tenant.name)}"></div>
      <div class="mb-3"><label class="form-label small fw-semibold" for="profileEmail">Email address</label><input class="form-control" id="profileEmail" name="email" type="email" maxlength="160" required value="${escapeHtml(context.tenant.email)}"></div>
      <div class="mb-3"><label class="form-label small fw-semibold" for="profilePhone">Phone number</label><input class="form-control" id="profilePhone" name="phone" type="tel" maxlength="30" required value="${escapeHtml(context.tenant.phone)}"></div>
      <button class="btn tenant-btn-primary w-100" type="submit">Save details</button>
    </form></div>`);
  sheet.element.querySelector('#tenantProfileForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const name = values.get('name').trim();
    const email = values.get('email').trim().toLowerCase();
    const phone = values.get('phone').trim();
    if (context.data.users.some((user) => user.id !== context.tenant.userId && user.email.toLowerCase() === email)) {
      context.toast('That email address is already used by another account.', 'error');
      return;
    }
    const tenants = context.data.tenants.map((tenant) => tenant.id === context.tenant.id ? { ...tenant, name, email, phone } : tenant);
    const users = context.data.users.map((user) => user.id === context.tenant.userId ? { ...user, name, email, phone } : user);
    try {
      // These store writes become the tenant and user profile API calls when a backend is introduced.
      context.save('tenants', tenants);
      context.save('users', users);
      context.save('auditLog', [...context.data.auditLog, auditEntry(context, 'Updated contact details', 'Tenant', `${context.tenant.name} updated their contact details.`)]);
      sheet.close();
      context.refresh();
      context.toast('Your details have been updated');
    } catch (error) {
      context.toast(`Could not update details: ${error.message}`, 'error');
    }
  });
}

function contactLandlord(context) {
  const notification = notificationEntry(context, 'admin', 'Tenant requested contact', `${context.tenant.name} asked the property team to contact them.`, 'u-admin', 'system');
  try {
    // These store writes become the contact-request notification and audit API calls when a backend is introduced.
    context.save('notifications', [...context.data.notifications, notification]);
    context.save('auditLog', [...context.data.auditLog, auditEntry(context, 'Requested contact', 'Support', `${context.tenant.name} asked the property team to contact them.`)]);
    context.toast('Your property team has been notified');
  } catch (error) {
    context.toast(`Could not contact the property team: ${error.message}`, 'error');
  }
}

export function renderMore(container, context) {
  const property = context.property;
  container.innerHTML = `<div class="page-enter"><h1 class="tenant-page-title">More</h1><p class="tenant-page-subtitle">Your account, tenancy details, help and preferences.</p>
    <section class="tenant-card mb-3"><div class="d-flex gap-3 align-items-center"><span class="tenant-brand-mark"><i class="bi bi-person"></i></span><div class="flex-grow-1"><strong>${escapeHtml(context.tenant.name)}</strong><div class="small text-secondary">${escapeHtml(context.tenant.email)}</div><div class="small text-secondary">${escapeHtml(context.tenant.phone)}</div></div><button class="btn btn-sm btn-light border" type="button" data-action="edit-profile" aria-label="Edit profile"><i class="bi bi-pencil"></i></button></div></section>
    <section class="tenant-card mb-3"><h2 class="h6 fw-bold">Tenancy details</h2><div class="summary-list"><div class="summary-item"><span class="summary-label">Property</span><span class="summary-value">${escapeHtml(property.name)}</span></div><div class="summary-item"><span class="summary-label">Monthly rent</span><span class="summary-value">${formatCurrency(Number(property.monthlyRent), context.data.config)}</span></div><div class="summary-item"><span class="summary-label">Tenancy</span><span class="summary-value">${formatDate(context.tenant.tenancyStart)} – ${formatDate(context.tenant.tenancyEnd)}</span></div><div class="summary-item"><span class="summary-label">Deposit scheme</span><span class="summary-value">${escapeHtml(property.depositScheme)} · ${escapeHtml(property.depositRef)}</span></div></div><p class="small text-secondary mt-2 mb-0">${escapeHtml(property.address)}, ${escapeHtml(property.postcode)}</p></section>
    <section class="tenant-card mb-3"><div class="tenant-settings-row"><div><strong class="d-block small">Dark mode</strong><span class="small text-secondary">Change the app appearance</span></div><div class="form-check form-switch mb-0"><input class="form-check-input" type="checkbox" id="darkModeToggle" role="switch" aria-label="Enable dark mode" ${context.theme === 'dark' ? 'checked' : ''}></div></div><button class="tenant-settings-row w-100 text-start border-0 bg-transparent" type="button" data-action="ai-help"><span><strong class="d-block small">AI help chat</strong><span class="small text-secondary">Ask about rent, repairs or documents</span></span><i class="bi bi-chevron-right"></i></button><button class="tenant-settings-row w-100 text-start border-0 bg-transparent" type="button" data-action="about-demo"><span><strong class="d-block small">About this demo</strong><span class="small text-secondary">What needs a live system</span></span><i class="bi bi-chevron-right"></i></button></section>
    <section class="tenant-card mb-3"><h2 class="h6 fw-bold mb-2">Help and support</h2><details class="tenant-faq"><summary>How do I report a repair?</summary><p>Open Issues and choose Report issue. For an emergency, contact your landlord or emergency services directly.</p></details><details class="tenant-faq"><summary>When is my rent due?</summary><p>Your rent is due on the ${context.tenant.rentDueDay}th of each month. Check Payments for the current rent schedule.</p></details><details class="tenant-faq"><summary>How do I share a document?</summary><p>Open Documents, choose Upload, and add the file. This demo records its filename only.</p></details><button class="btn btn-light border w-100 mt-3" type="button" data-action="contact-landlord"><i class="bi bi-chat-left-text me-1"></i>Contact landlord</button></section>
    <button class="btn btn-outline-danger w-100 mb-2" type="button" data-action="reset-demo"><i class="bi bi-arrow-counterclockwise me-1"></i>Reset demo data</button>
    <button class="btn btn-light border w-100" type="button" data-action="logout"><i class="bi bi-box-arrow-right me-1"></i>Sign out</button>
  </div>`;
  container.querySelector('#darkModeToggle').addEventListener('change', (event) => context.onThemeChange(event.currentTarget.checked ? 'dark' : 'light'));
  container.querySelector('[data-action="edit-profile"]').addEventListener('click', () => saveProfile(container, context));
  container.querySelector('[data-action="ai-help"]').addEventListener('click', () => openAiHelp(context));
  container.querySelector('[data-action="about-demo"]').addEventListener('click', () => renderAbout(context, container));
  container.querySelector('[data-action="contact-landlord"]').addEventListener('click', () => contactLandlord(context));
  container.querySelector('[data-action="reset-demo"]').addEventListener('click', () => {
    if (!window.confirm('Reset all shared demo changes in this browser? This cannot be undone.')) return;
    try {
      // This store operation becomes the backend demo reset API call when introduced.
      resetDemo();
      context.toast('Demo data restored to its original sample records');
    } catch (error) {
      context.toast(`Could not reset demo data: ${error.message}`, 'error');
    }
  });
  container.querySelector('[data-action="logout"]').addEventListener('click', context.onLogout);
}
