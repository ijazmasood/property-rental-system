import { formatCurrency } from '../../data/helpers/currency.js';
import { daysBetween, formatDate } from '../../data/helpers/date.js';
import { getDocumentStatus, getRentStatus } from '../../data/helpers/status.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function answerPortfolioQuestion(question, data) {
  const query = question.toLowerCase();
  const properties = new Map(data.properties.map((property) => [property.id, property]));
  const tenants = new Map(data.tenants.map((tenant) => [tenant.id, tenant]));
  if (query.includes('overdue') || query.includes('late rent')) {
    const rows = data.rentSchedule.filter((rent) => getRentStatus(rent, data.config) === 'overdue').map((rent) => ({
      Tenant: tenants.get(rent.tenantId)?.name || 'Tenant',
      Property: properties.get(rent.propertyId)?.name || 'Property',
      'Due date': formatDate(rent.dueDate),
      Balance: formatCurrency(Math.max(0, rent.amount - Number(rent.paidAmount || 0)), data.config)
    }));
    return { text: `${rows.length} rent item${rows.length === 1 ? '' : 's'} are overdue as of ${formatDate(data.config.demoToday)}.`, rows };
  }
  if (query.includes('certificate') || query.includes('document') || query.includes('expir')) {
    const month = data.config.demoToday.slice(0, 7);
    const types = new Map(data.documentTypes.map((type) => [type.id, type.name]));
    const rows = data.documents.filter((document) =>
      document.expiryDate.startsWith(month) && getDocumentStatus(document, data.config) !== 'expired'
    ).map((document) => ({
      Document: types.get(document.type) || document.type,
      Property: properties.get(document.propertyId)?.name || 'Property',
      'Expiry date': formatDate(document.expiryDate),
      Status: getDocumentStatus(document, data.config) === 'expiring' ? 'Expiring soon' : 'Valid'
    }));
    return { text: `${rows.length} documents expire this month (${formatDate(data.config.demoToday)}).`, rows };
  }
  if (query.includes('urgent') || query.includes('issue') || query.includes('repair')) {
    const rows = data.issues.filter((issue) => issue.priority === 'urgent' && !['resolved', 'closed'].includes(issue.status)).map((issue) => ({
      Issue: issue.title,
      Property: properties.get(issue.propertyId)?.name || 'Property',
      Priority: issue.priority,
      Status: issue.status
    }));
    return { text: `${rows.length} open urgent issue${rows.length === 1 ? '' : 's'} need attention.`, rows };
  }
  if (query.includes('collected') || query.includes('collection') || query.includes('payment')) {
    const month = data.config.demoToday.slice(0, 7);
    const rows = data.payments.filter((payment) => payment.date.startsWith(month));
    const collected = rows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const expected = data.rentSchedule.filter((rent) => rent.dueDate.startsWith(month)
      && getRentStatus(rent, data.config) !== 'overdue').reduce((sum, rent) => sum + Number(rent.amount || 0), 0);
    return {
      text: `Recorded rent receipts this month total ${formatCurrency(collected, data.config)}. Scheduled rent due this month is ${formatCurrency(expected, data.config)}. This is a read-only summary.`,
      rows: [{ 'Payments recorded': rows.length, 'Rent collected': formatCurrency(collected, data.config), 'Scheduled rent': formatCurrency(expected, data.config) }]
    };
  }
  if (query.includes('expiring soon')) {
    const rows = data.documents.filter((document) => getDocumentStatus(document, data.config) === 'expiring')
      .slice(0, 20).map((document) => ({
        Document: document.fileName,
        Property: properties.get(document.propertyId)?.name || 'Property',
        'Days remaining': daysBetween(data.config.demoToday, document.expiryDate)
      }));
    return { text: `${rows.length} document${rows.length === 1 ? '' : 's'} are within the configured reminder window.`, rows };
  }
  return {
    text: 'I can answer about overdue rent, certificates expiring this month, urgent issues, or rent collected this month. I only read the demo data and never change it.',
    rows: []
  };
}

export function renderAssistantResponse(result) {
  const table = result.rows.length
    ? `<div class="table-responsive mt-2"><table class="table table-sm align-middle mb-0"><thead><tr>${Object.keys(result.rows[0]).map((key) => `<th>${escapeHtml(key)}</th>`).join('')}</tr></thead><tbody>${result.rows.map((row) => `<tr>${Object.values(row).map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    : '';
  return `<article class="chat-message assistant"><div class="chat-avatar"><i class="bi bi-stars"></i></div><div class="chat-bubble"><p class="mb-0">${escapeHtml(result.text)}</p>${table}</div></article>`;
}

export function renderAiAssistant(container, context) {
  container.innerHTML = `<div class="page-header"><div><p class="page-eyebrow">Workspace</p><h1 class="page-title">AI Assistant</h1><p class="page-subtitle">Ask questions about the portfolio demo data.</p></div><span class="badge text-bg-info bg-opacity-10 text-info border border-info border-opacity-10">Read-only demo</span></div>
    <section class="panel-card mb-3"><div class="d-flex flex-wrap justify-content-between gap-2 align-items-start"><div><h2 class="h6 fw-bold mb-1">Portfolio assistant</h2><p class="small text-secondary mb-0">Answers use simple keyword matching against the loaded records. No records are created or changed.</p></div><span id="assistantLiveBadge"></span></div>
      <div class="d-flex flex-wrap gap-2 mt-3" id="assistantSuggestions">${['Who has overdue rent?', 'Which certificates expire this month?', 'Show open urgent issues', 'Total rent collected this month'].map((question) => `<button type="button" class="btn btn-sm btn-light border" data-question="${escapeHtml(question)}">${escapeHtml(question)}</button>`).join('')}</div>
    </section>
    <section class="panel-card"><div class="chat-thread" id="assistantThread" aria-live="polite"><article class="chat-message assistant"><div class="chat-avatar"><i class="bi bi-stars"></i></div><div class="chat-bubble"><p class="mb-0">Hello. I can summarise rent, compliance and issues from this demo. What would you like to know?</p></div></article></div>
      <form class="d-flex gap-2 mt-3" id="assistantForm"><label class="visually-hidden" for="assistantQuestion">Ask a question</label><input class="form-control" id="assistantQuestion" name="question" maxlength="240" placeholder="Ask about rent, certificates or issues" required><button class="btn btn-forest" type="submit" aria-label="Send question"><i class="bi bi-send"></i></button></form>
    </section>`;
  container.querySelector('#assistantLiveBadge').replaceWith(context.createNeedsLiveBadge('ai', 'Live AI needs live system'));
  const thread = container.querySelector('#assistantThread');
  const ask = (question) => {
    thread.insertAdjacentHTML('beforeend', `<article class="chat-message user"><div class="chat-bubble">${escapeHtml(question)}</div></article>${renderAssistantResponse(answerPortfolioQuestion(question, context.data))}`);
    container.querySelector('#assistantQuestion').value = '';
    thread.scrollTop = thread.scrollHeight;
  };
  container.querySelector('#assistantForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const question = container.querySelector('#assistantQuestion').value.trim();
    if (question) ask(question);
  });
  container.querySelector('#assistantSuggestions').addEventListener('click', (event) => {
    const button = event.target.closest('[data-question]');
    if (button) ask(button.dataset.question);
  });
}
