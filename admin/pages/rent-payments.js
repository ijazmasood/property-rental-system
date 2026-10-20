import { formatCurrency } from '../../data/helpers/currency.js';
import { daysBetween, formatDate } from '../../data/helpers/date.js';
import { getRentStatus } from '../../data/helpers/status.js';

const PAYMENT_METHODS = ['bank transfer', 'direct debit', 'card', 'cash'];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function getRows(data) {
  const properties = new Map(data.properties.map((property) => [property.id, property]));
  const tenants = new Map(data.tenants.map((tenant) => [tenant.id, tenant]));
  return data.rentSchedule.map((rent) => ({
    ...rent,
    computedStatus: getRentStatus(rent, data.config),
    balance: Math.max(0, rent.amount - Number(rent.paidAmount || 0)),
    property: properties.get(rent.propertyId),
    tenant: tenants.get(rent.tenantId)
  }));
}

function statusBadge(status) {
  const tone = { upcoming: 'primary', paid: 'success', partial: 'warning', overdue: 'danger' }[status] || 'secondary';
  const label = status[0].toUpperCase() + status.slice(1);
  return `<span class="badge text-bg-${tone} bg-opacity-10 text-${tone} border border-${tone} border-opacity-10">${escapeHtml(label)}</span>`;
}

function getInitialMonth(config) {
  return config.demoToday.slice(0, 7);
}

function paymentModal(row, data, markPaid) {
  const amount = markPaid ? row.balance : '';
  return `
    <div class="modal fade" id="paymentModal" tabindex="-1" aria-labelledby="paymentModalTitle" aria-hidden="true">
      <div class="modal-dialog">
        <form class="modal-content" id="paymentForm" data-rent-id="${escapeHtml(row.id)}">
          <div class="modal-header"><h2 class="modal-title fs-5" id="paymentModalTitle">${markPaid ? 'Mark rent paid' : 'Record rent payment'}</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
          <div class="modal-body">
            <p class="small text-secondary">${escapeHtml(row.tenant?.name || 'Tenant')} · ${escapeHtml(row.property?.name || 'Property')} · ${formatDate(row.dueDate)}</p>
            <div class="alert alert-light border py-2 small">Due ${formatCurrency(row.amount, data.config)} · received ${formatCurrency(row.paidAmount || 0, data.config)} · balance ${formatCurrency(row.balance, data.config)}</div>
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label" for="paymentAmount">Amount received (£)</label><input class="form-control" id="paymentAmount" name="amount" type="number" min="0.01" max="${row.balance}" step="0.01" value="${amount}" required></div>
              <div class="col-md-6"><label class="form-label" for="paymentDate">Payment date</label><input class="form-control" id="paymentDate" name="date" type="date" max="${escapeHtml(data.config.demoToday)}" value="${escapeHtml(data.config.demoToday)}" required></div>
              <div class="col-md-6"><label class="form-label" for="paymentMethod">Method</label><select class="form-select" id="paymentMethod" name="method" required>${PAYMENT_METHODS.map((method) => `<option value="${method}">${method}</option>`).join('')}</select></div>
              <div class="col-md-6"><label class="form-label" for="paymentReference">Reference (optional)</label><input class="form-control" id="paymentReference" name="reference" maxlength="50" placeholder="e.g. rent transfer"></div>
            </div>
            <p class="small text-secondary mt-3 mb-0">Payments recorded here are manual demo entries; no money is collected.</p>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-forest">${markPaid ? 'Confirm payment' : 'Record payment'}</button></div>
        </form>
      </div>
    </div>`;
}

function renderSchedule(container, data, role) {
  const month = container.querySelector('#rentMonth').value;
  const overdueOnly = container.querySelector('#overdueOnly').checked;
  const propertyId = container.querySelector('#rentPropertyFilter').value;
  const rows = getRows(data).filter((row) =>
    row.dueDate.startsWith(month)
    && (!overdueOnly || row.computedStatus === 'overdue')
    && (!propertyId || row.propertyId === propertyId)
  ).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.property?.name || '').localeCompare(b.property?.name || ''));
  const expected = rows.reduce((sum, row) => sum + row.amount, 0);
  const collected = rows.reduce((sum, row) => sum + Number(row.paidAmount || 0), 0);
  const outstanding = rows.reduce((sum, row) => sum + row.balance, 0);

  container.querySelector('#rentScheduleCount').textContent = `${rows.length} ${rows.length === 1 ? 'rent entry' : 'rent entries'}`;
  container.querySelector('#rentExpectedTotal').textContent = formatCurrency(expected, data.config);
  container.querySelector('#rentCollectedTotal').textContent = formatCurrency(collected, data.config);
  container.querySelector('#rentOutstandingTotal').textContent = formatCurrency(outstanding, data.config);
  container.querySelector('#rentScheduleResults').innerHTML = rows.length
    ? `<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Tenant / property</th><th>Due date</th><th class="text-end">Amount</th><th class="text-end">Received</th><th class="text-end">Balance</th><th>Status</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>${rows.map((row) => `<tr>
      <td>${row.tenant ? `<a class="fw-semibold text-decoration-none" href="#/tenants/${encodeURIComponent(row.tenant.id)}">${escapeHtml(row.tenant.name)}</a>` : '<span class="text-secondary">Tenant not found</span>'}<div class="small text-secondary">${row.property ? escapeHtml(row.property.name) : 'Property not found'}</div></td>
      <td>${formatDate(row.dueDate)}<div class="small text-secondary">${row.computedStatus === 'overdue' ? `${Math.abs(daysBetween(data.config.demoToday, row.dueDate))} days overdue` : ''}</div></td>
      <td class="text-end">${formatCurrency(row.amount, data.config)}</td><td class="text-end">${formatCurrency(Number(row.paidAmount || 0), data.config)}</td><td class="text-end fw-semibold">${formatCurrency(row.balance, data.config)}</td>
      <td>${statusBadge(row.computedStatus)}</td>
      <td class="text-end text-nowrap">${row.computedStatus !== 'paid' && role !== 'accountant' ? `<button class="btn btn-sm btn-light" data-action="record-payment" data-id="${escapeHtml(row.id)}">Record payment</button> <button class="btn btn-sm btn-light" data-action="mark-paid" data-id="${escapeHtml(row.id)}">Mark paid</button> ` : ''}<button class="btn btn-sm btn-outline-secondary" data-action="send-reminder" data-id="${escapeHtml(row.id)}" ${role === 'accountant' || row.computedStatus === 'paid' ? 'disabled' : ''} aria-label="Send rent reminder to ${escapeHtml(row.tenant?.name || 'tenant')}"><i class="bi bi-send"></i></button></td>
    </tr>`).join('')}</tbody></table></div>`
    : '<div class="empty-state"><i class="bi bi-calendar2-check"></i>No rent entries match this month and filter.</div>';
}

function renderPaymentHistory(container, data) {
  const month = container.querySelector('#rentMonth').value;
  const tenants = new Map(data.tenants.map((tenant) => [tenant.id, tenant]));
  const properties = new Map(data.properties.map((property) => [property.id, property]));
  const payments = data.payments.filter((payment) => payment.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  container.querySelector('#paymentHistoryCount').textContent = payments.length;
  container.querySelector('#paymentHistoryResults').innerHTML = payments.length
    ? `<div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Date</th><th>Tenant</th><th>Property</th><th>Method</th><th>Reference</th><th class="text-end">Amount</th></tr></thead><tbody>${payments.map((payment) => `<tr><td>${formatDate(payment.date)}</td><td>${escapeHtml(tenants.get(payment.tenantId)?.name || 'Tenant')}</td><td>${escapeHtml(properties.get(payment.propertyId)?.name || 'Property')}</td><td>${escapeHtml(payment.method)}</td><td>${escapeHtml(payment.reference || '—')}</td><td class="text-end fw-semibold">${formatCurrency(payment.amount, data.config)}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="empty-state"><i class="bi bi-cash"></i>No payment records for this month.</div>';
}

export function renderRentPayments(container, context) {
  const canEdit = context.role !== 'accountant';
  const month = getInitialMonth(context.data.config);
  const allRows = getRows(context.data);
  const monthRows = allRows.filter((row) => row.dueDate.startsWith(month));
  const overdueRows = monthRows.filter((row) => row.computedStatus === 'overdue');
  container.innerHTML = `
    <div class="page-header"><div><p class="page-eyebrow">Finance</p><h1 class="page-title">Rent and Payments</h1><p class="page-subtitle">Review scheduled rent, record payments and follow up overdue balances.</p></div><div class="d-flex align-items-center gap-2">${canEdit ? '<span id="rentGatewayBadge"></span>' : '<span class="small text-secondary">Read-only access</span>'}</div></div>
    <div class="row g-3 mb-3">
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Expected this month</div><div class="stat-value">${formatCurrency(monthRows.reduce((sum, row) => sum + row.amount, 0), context.data.config)}</div><div class="stat-hint">${monthRows.length} scheduled items</div></div></div>
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Received this month</div><div class="stat-value text-success">${formatCurrency(monthRows.reduce((sum, row) => sum + Number(row.paidAmount || 0), 0), context.data.config)}</div><div class="stat-hint">Against this month’s schedule</div></div></div>
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Outstanding</div><div class="stat-value">${formatCurrency(monthRows.reduce((sum, row) => sum + row.balance, 0), context.data.config)}</div><div class="stat-hint">Remaining to collect</div></div></div>
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Overdue items</div><div class="stat-value text-danger">${overdueRows.length}</div><div class="stat-hint">${formatCurrency(overdueRows.reduce((sum, row) => sum + row.balance, 0), context.data.config)} outstanding</div></div></div>
    </div>
    <section class="panel-card mb-3">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3"><div><h2 class="h6 fw-bold mb-1">Rent schedule</h2><p class="small text-secondary mb-0">Status is calculated using the configured demo date.</p></div><span id="rentScheduleCount" class="small text-secondary"></span></div>
      <div class="row g-2 align-items-center mb-3">
        <div class="col-6 col-md-3"><label class="form-label small mb-1" for="rentMonth">Month</label><input class="form-control form-control-sm" id="rentMonth" type="month" value="${month}"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-1" for="rentPropertyFilter">Property</label><select class="form-select form-select-sm" id="rentPropertyFilter"><option value="">All properties</option>${context.data.properties.map((property) => `<option value="${escapeHtml(property.id)}">${escapeHtml(property.name)}</option>`).join('')}</select></div>
        <div class="col-12 col-md-6 d-flex align-items-end justify-content-between gap-2"><div class="form-check mb-1"><input class="form-check-input" id="overdueOnly" type="checkbox"><label class="form-check-label small" for="overdueOnly">Overdue only</label></div><div class="d-flex gap-3 small text-secondary"><span>Expected <strong class="text-dark" id="rentExpectedTotal"></strong></span><span>Received <strong class="text-success" id="rentCollectedTotal"></strong></span><span>Balance <strong class="text-dark" id="rentOutstandingTotal"></strong></span></div></div>
      </div>
      <div id="rentScheduleResults"></div>
    </section>
    <section class="panel-card"><div class="d-flex justify-content-between align-items-center mb-3"><div><h2 class="h6 fw-bold mb-1">Payment history</h2><p class="small text-secondary mb-0">Payments recorded for the selected month.</p></div><span class="badge bg-light text-secondary"><span id="paymentHistoryCount">0</span></span></div><div id="paymentHistoryResults"></div></section>
    <div id="paymentModalHost"></div>`;
  if (canEdit) {
    const liveBadge = context.createNeedsLiveBadge('payments', 'Collect payment');
    container.querySelector('#rentGatewayBadge').replaceWith(liveBadge);
  }
  const update = () => {
    renderSchedule(container, { ...context.data, role: context.role }, context.role);
    renderPaymentHistory(container, context.data);
  };
  container.querySelector('#rentMonth').addEventListener('change', update);
  container.querySelector('#rentPropertyFilter').addEventListener('change', update);
  container.querySelector('#overdueOnly').addEventListener('change', update);
  update();
  if (!canEdit) return;

  container.onclick = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const row = getRows(context.data).find((item) => item.id === button.dataset.id);
    if (!row) return;
    if (button.dataset.action === 'record-payment' || button.dataset.action === 'mark-paid') {
      if (row.balance <= 0) {
        context.toast('This rent item has no outstanding balance.', 'info');
        return;
      }
      const host = container.querySelector('#paymentModalHost');
      host.innerHTML = paymentModal(row, context.data, button.dataset.action === 'mark-paid');
      const form = host.querySelector('#paymentForm');
      form.addEventListener('submit', (submitEvent) => {
        submitEvent.preventDefault();
        if (form.reportValidity()) recordPayment(row, new FormData(form), context, host.querySelector('#paymentModal'));
      });
      window.bootstrap.Modal.getOrCreateInstance(host.querySelector('#paymentModal')).show();
    }
    if (button.dataset.action === 'send-reminder') sendRentReminder(row, context);
  };
}

function recordPayment(row, values, context, modalElement) {
  const amount = Number(values.get('amount'));
  if (!Number.isFinite(amount) || amount <= 0 || amount > row.balance) {
    context.toast('Payment must be greater than zero and no more than the outstanding balance.', 'error');
    return;
  }
  const paymentDate = values.get('date');
  if (paymentDate > context.data.config.demoToday) {
    context.toast('Payment date cannot be later than the demo date.', 'error');
    return;
  }
  const tenant = context.data.tenants.find((item) => item.id === row.tenantId);
  if (!tenant || paymentDate < tenant.tenancyStart) {
    context.toast('Payment date cannot be earlier than the tenancy start date.', 'error');
    return;
  }
  if (!PAYMENT_METHODS.includes(values.get('method'))) {
    context.toast('Choose a valid payment method.', 'error');
    return;
  }
  const payment = {
    id: makeId('pay'),
    tenantId: row.tenantId,
    propertyId: row.propertyId,
    amount,
    date: paymentDate,
    method: values.get('method'),
    reference: values.get('reference').trim() || `MAN-${context.data.config.demoToday.replaceAll('-', '')}-${row.id}`,
    rentScheduleId: row.id,
    source: 'manual',
    matchStatus: 'matched'
  };
  const schedule = context.data.rentSchedule.find((item) => item.id === row.id);
  schedule.paidAmount = Number(schedule.paidAmount || 0) + amount;
  schedule.status = schedule.paidAmount >= schedule.amount ? 'paid' : 'partial';
  schedule.paidOn = schedule.status === 'paid' ? paymentDate : null;
  schedule.method = values.get('method');
  const paymentNotification = {
    id: makeId('notification'),
    userId: tenant?.userId || row.tenantId,
    audience: 'tenant',
    title: schedule.status === 'paid' ? 'Rent payment recorded' : 'Rent part-payment recorded',
    body: `${formatCurrency(amount, context.data.config)} was recorded for ${row.property?.name || 'your property'} on ${formatDate(paymentDate)}.`,
    type: 'rent',
    createdOn: context.data.config.demoToday,
    read: false
  };
  const adminNotification = {
    id: makeId('notification'),
    userId: context.role === 'superadmin' ? 'u-admin' : 'u-manager',
    audience: 'admin',
    title: 'Rent payment recorded',
    body: `${formatCurrency(amount, context.data.config)} received from ${tenant?.name || 'a tenant'} for ${row.property?.name || 'a property'}.`,
    type: 'rent',
    createdOn: context.data.config.demoToday,
    read: false
  };
  const ledgerEntries = [
    { id: makeId('led'), date: paymentDate, accountId: 'acc-bank', propertyId: row.propertyId, description: `Rent received - ${tenant?.name || 'tenant'}`, debit: amount, credit: 0, linkedPaymentId: payment.id, linkedBillId: null },
    { id: makeId('led'), date: paymentDate, accountId: 'acc-rent', propertyId: row.propertyId, description: `Rent income - ${tenant?.name || 'tenant'}`, debit: 0, credit: amount, linkedPaymentId: payment.id, linkedBillId: null }
  ];
  context.data.payments.push(payment);
  context.data.notifications.push(paymentNotification, adminNotification);
  context.data.ledger.push(...ledgerEntries);
  const audit = {
    id: makeId('audit'),
    date: `${context.data.config.demoToday}T12:00:00`,
    userName: context.role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
    action: 'Payment recorded',
    entity: 'Rent',
    detail: `${formatCurrency(amount, context.data.config)} ${schedule.status === 'paid' ? 'settled' : 'part-paid'} ${row.id} for ${tenant?.name || 'tenant'}.`
  };
  try {
    // These store writes become the corresponding API calls when the shared JSON overlay is replaced.
    context.save('rentSchedule', context.data.rentSchedule);
    context.save('payments', context.data.payments);
    context.save('ledger', context.data.ledger);
    context.save('notifications', context.data.notifications);
    context.save('auditLog', [...context.data.auditLog, audit]);
    window.bootstrap.Modal.getInstance(modalElement)?.hide();
    context.refresh();
    context.toast(`${formatCurrency(amount, context.data.config)} payment recorded`);
  } catch (error) {
    context.toast(`Could not record payment: ${error.message}`, 'error');
  }
}

function sendRentReminder(row, context) {
  const tenant = context.data.tenants.find((item) => item.id === row.tenantId);
  if (!tenant) {
    context.toast('Tenant not found; reminder was not created.', 'error');
    return;
  }
  const userId = tenant.userId;
  context.data.notifications.push({
    id: makeId('notification'),
    userId,
    audience: 'tenant',
    title: 'Rent payment reminder',
    body: `${formatCurrency(row.balance, context.data.config)} is due for ${row.property?.name || 'your property'} on ${formatDate(row.dueDate)}.`,
    type: 'rent',
    createdOn: context.data.config.demoToday,
    read: false
  });
  try {
    // These store writes become the corresponding API calls when the shared JSON overlay is replaced.
    context.save('notifications', context.data.notifications);
    context.save('auditLog', [...context.data.auditLog, {
      id: makeId('audit'),
      date: `${context.data.config.demoToday}T12:00:00`,
      userName: context.role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
      action: 'Reminder created',
      entity: 'Rent',
      detail: `In-app rent reminder created for ${tenant.name} for ${formatCurrency(row.balance, context.data.config)}.`
    }]);
    context.toast(`In-app reminder created for ${tenant.name}`);
  } catch (error) {
    context.toast(`Could not create rent reminder: ${error.message}`, 'error');
  }
}
