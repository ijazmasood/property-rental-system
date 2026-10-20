import { formatCurrency } from '../../data/helpers/currency.js';
import { daysBetween, formatDate } from '../../data/helpers/date.js';
import { getRentStatus } from '../../data/helpers/status.js';
import { auditEntry, escapeHtml, makeId, notificationEntry, openSheet, sheetHeader } from './shared.js';

const TABS = [
  ['upcoming', 'Upcoming'],
  ['due', 'Due or overdue'],
  ['history', 'History']
];

function statusPill(status) {
  const tone = status === 'paid' ? '' : status === 'overdue' ? 'danger' : status === 'partial' ? 'warning' : 'warning';
  return `<span class="status-pill ${tone}">${escapeHtml(status)}</span>`;
}

function getPaymentRows(context) {
  return context.data.rentSchedule.filter((rent) => rent.tenantId === context.tenant.id)
    .map((rent) => ({
      ...rent,
      status: getRentStatus(rent, context.data.config),
      balance: Math.max(0, Number(rent.amount) - Number(rent.paidAmount || 0))
    }))
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
}

function renderRows(container, context, selectedTab) {
  const rows = getPaymentRows(context).filter((row) => {
    if (selectedTab === 'history') return row.status === 'paid';
    if (selectedTab === 'due') return row.status !== 'paid' && row.dueDate <= context.data.config.demoToday;
    return row.status !== 'paid' && row.dueDate > context.data.config.demoToday;
  });
  const list = container.querySelector('#paymentList');
  list.innerHTML = rows.length ? rows.map((row) => {
    const outstanding = row.status === 'paid' ? 0 : row.balance;
    const canPay = row.status !== 'paid';
    const receipt = context.data.payments.find((payment) => payment.rentScheduleId === row.id);
    return `<article class="tenant-card payment-card mb-2">
      <div class="d-flex justify-content-between align-items-start gap-2"><div><span class="small text-secondary">${row.status === 'paid' ? 'Paid' : 'Due'} ${formatDate(row.dueDate)}</span><h2 class="h5 fw-bold mt-1 mb-0">${formatCurrency(outstanding || Number(row.amount), context.data.config)}</h2></div>${statusPill(row.status)}</div>
      ${row.status === 'partial' ? `<p class="small text-secondary mt-2 mb-0">Paid ${formatCurrency(Number(row.paidAmount), context.data.config)} · balance ${formatCurrency(row.balance, context.data.config)}</p>` : ''}
      <div class="d-flex gap-2 mt-3">${canPay ? `<button type="button" class="btn tenant-btn-primary flex-fill" data-action="pay" data-id="${escapeHtml(row.id)}">Pay now</button>` : ''}${receipt ? `<button type="button" class="btn btn-light border ${canPay ? '' : 'flex-fill'}" data-action="receipt" data-id="${escapeHtml(receipt.id)}"><i class="bi bi-receipt me-1"></i>Receipt</button>` : row.status === 'paid' ? `<button type="button" class="btn btn-light border flex-fill" disabled>Receipt unavailable</button>` : ''}</div>
    </article>`;
  }).join('') : `<section class="tenant-card"><div class="empty-state"><i class="bi bi-cash-coin"></i>${selectedTab === 'history' ? 'No rent payments recorded yet.' : selectedTab === 'due' ? 'Nothing is due right now.' : 'No upcoming rent payments.'}</div></section>`;
}

function checkoutMarkup(rent, context, method = 'card') {
  const amount = Math.max(0, Number(rent.amount) - Number(rent.paidAmount || 0));
  return `${sheetHeader('Pay rent', `${formatDate(rent.dueDate)} · ${formatCurrency(amount, context.data.config)}`)}
    <div class="tenant-sheet-body">
      <span class="live-badge-static"><i class="bi bi-info-circle"></i>Demo: needs live payment gateway</span>
      <div class="form-check tenant-payment-method mt-3"><input class="form-check-input" type="radio" name="paymentMethod" id="methodCard" value="card" ${method === 'card' ? 'checked' : ''}><label class="form-check-label" for="methodCard"><i class="bi bi-credit-card me-2"></i>Card</label></div>
      <div class="form-check tenant-payment-method"><input class="form-check-input" type="radio" name="paymentMethod" id="methodBank" value="bank transfer" ${method === 'bank transfer' ? 'checked' : ''}><label class="form-check-label" for="methodBank"><i class="bi bi-bank me-2"></i>Pay by bank</label></div>
      <div class="form-check tenant-payment-method"><input class="form-check-input" type="radio" name="paymentMethod" id="methodDebit" value="direct debit" ${method === 'direct debit' ? 'checked' : ''}><label class="form-check-label" for="methodDebit"><i class="bi bi-arrow-repeat me-2"></i>Direct Debit</label></div>
      <form id="checkoutForm" class="mt-3">
        <div id="cardFields"><label class="form-label small fw-semibold" for="cardName">Name on card</label><input class="form-control mb-2" id="cardName" name="cardName" autocomplete="cc-name" maxlength="100" required><label class="form-label small fw-semibold" for="cardNumber">Demo card number</label><input class="form-control mb-2" id="cardNumber" name="cardNumber" inputmode="numeric" autocomplete="cc-number" maxlength="19" placeholder="4242 4242 4242 4242" pattern="(?:\\d(?: |-)?){13,19}" required><div class="row g-2"><div class="col-6"><label class="form-label small fw-semibold" for="cardExpiry">Expiry</label><input class="form-control" id="cardExpiry" name="expiry" autocomplete="cc-exp" placeholder="MM/YY" pattern="(0[1-9]|1[0-2])\\/\\d{2}" required></div><div class="col-6"><label class="form-label small fw-semibold" for="cardCvc">CVC</label><input class="form-control" id="cardCvc" name="cvc" inputmode="numeric" maxlength="4" pattern="\\d{3,4}" required></div></div></div>
        <div id="bankFields" class="d-none"><div class="alert alert-light border small mb-0"><i class="bi bi-shield-check me-1"></i>A demo bank authorisation will be shown. No bank connection is made.</div></div>
        <div id="debitFields" class="d-none"><label class="form-label small fw-semibold" for="accountName">Account holder</label><input class="form-control mb-2" id="accountName" name="accountName" autocomplete="name" maxlength="100"><label class="form-label small fw-semibold" for="accountNumber">Account number</label><input class="form-control mb-2" id="accountNumber" name="accountNumber" inputmode="numeric" maxlength="8" pattern="\\d{8}" placeholder="8 digits"><label class="form-label small fw-semibold" for="sortCode">Sort code</label><input class="form-control" id="sortCode" name="sortCode" inputmode="numeric" maxlength="8" pattern="\\d{2}[- ]?\\d{2}[- ]?\\d{2}" placeholder="00-00-00"></div>
        <button class="btn tenant-btn-primary w-100 mt-3" type="submit">Pay ${formatCurrency(amount, context.data.config)}</button>
      </form>
      <p class="small text-secondary text-center mt-2 mb-0">This is a simulation; no payment details are transmitted or stored.</p>
    </div>`;
}

function openCheckout(container, context, rent) {
  let selectedMethod = 'card';
  let sheet;
  const render = () => {
    sheet?.close();
    sheet = openSheet(checkoutMarkup(rent, context, selectedMethod));
    const form = sheet.element.querySelector('#checkoutForm');
    const options = sheet.element.querySelectorAll('[name="paymentMethod"]');
    const fields = {
      card: sheet.element.querySelector('#cardFields'),
      'bank transfer': sheet.element.querySelector('#bankFields'),
      'direct debit': sheet.element.querySelector('#debitFields')
    };
    const updateMethod = () => {
      selectedMethod = sheet.element.querySelector('[name="paymentMethod"]:checked').value;
      Object.entries(fields).forEach(([method, field]) => field.classList.toggle('d-none', method !== selectedMethod));
      for (const input of form.querySelectorAll('input')) input.required = false;
      if (selectedMethod === 'card') {
        for (const id of ['cardName', 'cardNumber', 'cardExpiry', 'cardCvc']) form.querySelector(`#${id}`).required = true;
      } else if (selectedMethod === 'direct debit') {
        for (const id of ['accountName', 'accountNumber', 'sortCode']) form.querySelector(`#${id}`).required = true;
      }
    };
    options.forEach((option) => option.addEventListener('change', updateMethod));
    updateMethod();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing demo payment…';
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      sheet.close();
      savePayment(context, rent, selectedMethod);
    });
  };
  render();
}

function savePayment(context, rent, method) {
  const currentRent = context.data.rentSchedule.find((item) => item.id === rent.id && item.tenantId === context.tenant.id);
  if (!currentRent || getRentStatus(currentRent, context.data.config) === 'paid') {
    context.toast('This rent item is no longer available for payment.', 'error');
    return;
  }
  const amount = Math.max(0, Number(currentRent.amount) - Number(currentRent.paidAmount || 0));
  if (!amount) {
    context.toast('There is no outstanding balance to pay.', 'info');
    return;
  }
  const paymentId = makeId('payment');
  const reference = `LD-${currentRent.dueDate.replaceAll('-', '')}-${paymentId.slice(-6).toUpperCase()}`;
  const payment = {
    id: paymentId,
    tenantId: context.tenant.id,
    propertyId: context.tenant.propertyId,
    amount,
    date: context.data.config.demoToday,
    method,
    reference,
    rentScheduleId: currentRent.id,
    source: 'gateway',
    matchStatus: 'matched'
  };
  const rentSchedule = context.data.rentSchedule.map((item) => item.id === currentRent.id
    ? { ...item, paidAmount: Number(item.paidAmount || 0) + amount, status: 'paid', paidOn: context.data.config.demoToday, method }
    : item);
  const accountIds = new Set(context.data.accounts.map((account) => account.id));
  if (!accountIds.has('acc-bank') || !accountIds.has('acc-rent')) {
    context.toast('Required rent and bank ledger accounts are missing; payment was not recorded.', 'error');
    return;
  }
  const ledgerEntries = [
    { id: makeId('ledger'), date: context.data.config.demoToday, accountId: 'acc-bank', propertyId: context.tenant.propertyId, description: `Rent received - ${context.tenant.name}`, debit: amount, credit: 0, linkedPaymentId: paymentId, linkedBillId: null },
    { id: makeId('ledger'), date: context.data.config.demoToday, accountId: 'acc-rent', propertyId: context.tenant.propertyId, description: `Rent income - ${context.tenant.name}`, debit: 0, credit: amount, linkedPaymentId: paymentId, linkedBillId: null }
  ];
  const notification = notificationEntry(context, 'admin', 'Rent payment received', `${context.tenant.name} paid ${formatCurrency(amount, context.data.config)} for rent due ${formatDate(currentRent.dueDate)}.`, 'u-admin', 'rent');
  const audit = auditEntry(context, 'Paid', 'Rent', `${context.tenant.name} paid ${formatCurrency(amount, context.data.config)} for ${formatDate(currentRent.dueDate)} via ${method}; reference ${reference}.`);
  try {
    // These store writes become the payment, rent, ledger, notification and audit API calls when a backend is introduced.
    context.save('payments', [...context.data.payments, payment]);
    context.save('rentSchedule', rentSchedule);
    context.save('ledger', [...context.data.ledger, ...ledgerEntries]);
    context.save('notifications', [...context.data.notifications, notification]);
    context.save('auditLog', [...context.data.auditLog, audit]);
    context.refresh();
    context.toast('Demo payment completed. Your rent is marked as paid.');
    openReceipt(context, payment);
  } catch (error) {
    context.toast(`Could not save payment: ${error.message}`, 'error');
  }
}

function openReceipt(context, payment) {
  openSheet(`${sheetHeader('Payment complete', 'Your demo rent payment has been recorded')}
    <div class="tenant-sheet-body text-center">
      <span class="receipt-success"><i class="bi bi-check-lg"></i></span>
      <h3 class="h5 fw-bold mt-3">Thank you, ${escapeHtml(context.tenant.name.split(' ')[0])}</h3>
      <p class="display-6 fw-bold my-2">${formatCurrency(payment.amount, context.data.config)}</p>
      <div class="tenant-card text-start small"><div class="d-flex justify-content-between py-1"><span class="text-secondary">Paid on</span><strong>${formatDate(payment.date)}</strong></div><div class="d-flex justify-content-between py-1"><span class="text-secondary">Method</span><strong>${escapeHtml(payment.method)}</strong></div><div class="d-flex justify-content-between py-1"><span class="text-secondary">Reference</span><strong>${escapeHtml(payment.reference)}</strong></div></div>
      <button type="button" class="live-badge-static mt-3" data-live-feature="payments"><i class="bi bi-file-earmark-pdf"></i>PDF receipt needs live system</button>
      <button type="button" class="btn tenant-btn-primary w-100 mt-3" data-sheet-dismiss-button>Done</button>
    </div>`);
}

function openReceiptHistory(context, payment) {
  openSheet(`${sheetHeader('Payment receipt', 'A copy of your demo payment details')}
    <div class="tenant-sheet-body">
      <div class="tenant-card"><div class="d-flex justify-content-between py-2 border-bottom"><span class="text-secondary">Amount</span><strong>${formatCurrency(payment.amount, context.data.config)}</strong></div><div class="d-flex justify-content-between py-2 border-bottom"><span class="text-secondary">Paid on</span><strong>${formatDate(payment.date)}</strong></div><div class="d-flex justify-content-between py-2 border-bottom"><span class="text-secondary">Payment method</span><strong>${escapeHtml(payment.method)}</strong></div><div class="d-flex justify-content-between py-2"><span class="text-secondary">Reference</span><strong>${escapeHtml(payment.reference)}</strong></div></div>
      <button type="button" class="live-badge-static mt-3" data-live-feature="payments"><i class="bi bi-file-earmark-pdf"></i>Download PDF receipt needs live system</button>
    </div>`);
}

export function renderPayments(container, context) {
  let selectedTab = 'upcoming';
  const balance = getPaymentRows(context).filter((row) => row.status !== 'paid')
    .reduce((sum, row) => sum + row.balance, 0);
  container.innerHTML = `<div class="page-enter">
    <h1 class="tenant-page-title">Payments</h1><p class="tenant-page-subtitle">Your rent schedule and payment history.</p>
    <section class="rent-card payment-summary"><span class="rent-label">Outstanding rent balance</span><p class="rent-amount">${formatCurrency(balance, context.data.config)}</p><span class="rent-meta">Payments are simulated; no money is collected.</span></section>
    <div class="d-flex align-items-center justify-content-between mt-3 mb-2"><span id="paymentGatewayBadge"></span><button class="btn btn-sm btn-light border" type="button" data-live-feature="payments"><i class="bi bi-info-circle me-1"></i>About demo</button></div>
    <div class="payment-tabs" role="tablist" aria-label="Payment history">${TABS.map(([id, label]) => `<button class="payment-tab ${selectedTab === id ? 'active' : ''}" type="button" role="tab" aria-selected="${selectedTab === id}" data-payment-tab="${id}">${label}</button>`).join('')}</div>
    <div id="paymentList" class="mt-2"></div>
  </div>`;
  container.querySelector('#paymentGatewayBadge').replaceWith(context.createNeedsLiveBadge('payments', 'Demo: needs live payment gateway'));
  const update = () => renderRows(container, context, selectedTab);
  container.querySelectorAll('[data-payment-tab]').forEach((button) => button.addEventListener('click', () => {
    selectedTab = button.dataset.paymentTab;
    container.querySelectorAll('[data-payment-tab]').forEach((tab) => {
      tab.classList.toggle('active', tab === button);
      tab.setAttribute('aria-selected', String(tab === button));
    });
    update();
  }));
  container.onclick = (event) => {
    const payButton = event.target.closest('[data-action="pay"]');
    const receiptButton = event.target.closest('[data-action="receipt"]');
    if (payButton) {
      const rent = context.data.rentSchedule.find((item) => item.id === payButton.dataset.id);
      if (rent) openCheckout(container, context, rent);
    } else if (receiptButton) {
      const payment = context.data.payments.find((item) => item.id === receiptButton.dataset.id && item.tenantId === context.tenant.id);
      if (payment) openReceiptHistory(context, payment);
    }
  };
  update();
}
