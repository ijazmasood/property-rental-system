import { formatCurrency } from '../../data/helpers/currency.js';
import { formatDate } from '../../data/helpers/date.js';
import { auditEntry, escapeHtml, notificationEntry, openSheet, sheetHeader } from './shared.js';

function statusPill(status) {
  const tone = status === 'approved' ? '' : status === 'sent' ? 'warning' : '';
  const label = status === 'sent' ? 'Awaiting your review' : status[0].toUpperCase() + status.slice(1);
  return `<span class="status-pill ${tone}">${escapeHtml(label)}</span>`;
}

function renderRows(container, context) {
  const contracts = context.data.contracts.filter((contract) =>
    contract.tenantId === context.tenant.id && contract.status !== 'draft'
  ).sort((a, b) => (b.sentOn || '').localeCompare(a.sentOn || ''));
  container.querySelector('#tenantContractCount').textContent = `${contracts.length} ${contracts.length === 1 ? 'agreement' : 'agreements'}`;
  container.querySelector('#tenantContractList').innerHTML = contracts.length
    ? contracts.map((contract) => `<article class="tenant-card mb-2">
        <div class="d-flex gap-3 align-items-start"><span class="document-type-icon"><i class="bi bi-file-earmark-text"></i></span><div class="document-info"><strong>${escapeHtml(contract.title)}</strong><span>Version ${escapeHtml(contract.version)} · Sent ${formatDate(contract.sentOn)}</span><small>${formatDate(contract.startDate)} – ${formatDate(contract.endDate)}</small></div></div>
        <div class="d-flex justify-content-between align-items-center mt-3"><span>${statusPill(contract.status)}</span><button class="btn btn-sm btn-light border" type="button" data-action="view-contract" data-id="${escapeHtml(contract.id)}">View agreement</button></div>
      </article>`).join('')
    : `<section class="tenant-card"><div class="empty-state"><i class="bi bi-file-earmark-check"></i>No agreements are waiting for you. New agreements from your landlord will appear here.</div></section>`;
}

function agreementText(contract, context) {
  const property = context.property;
  return `<div class="agreement-document">
    <p class="small text-secondary">DEMO AGREEMENT · NOT A LEGAL DOCUMENT</p>
    <h3 class="h5 fw-bold">Assured Tenancy Agreement</h3>
    <p class="small">Agreement version ${escapeHtml(contract.version)} for the property at <strong>${escapeHtml(property.address)}, ${escapeHtml(property.postcode)}</strong>.</p>
    <h4>1. Parties</h4><p>The landlord and tenant agree to the terms of this sample tenancy for the residential property listed above.</p>
    <h4>2. Term</h4><p>The tenancy begins on <strong>${formatDate(contract.startDate)}</strong> and is due to end on <strong>${formatDate(contract.endDate)}</strong>, subject to the terms of the full agreement.</p>
    <h4>3. Rent</h4><p>Rent is <strong>${formatCurrency(Number(property.monthlyRent), context.data.config)}</strong> per calendar month, payable on the ${context.tenant.rentDueDay}${({ 1: 'st', 2: 'nd', 3: 'rd' }[context.tenant.rentDueDay % 10] || 'th')} day of each month.</p>
    <h4>4. Deposit</h4><p>A deposit of <strong>${formatCurrency(Number(property.deposit), context.data.config)}</strong> is recorded with ${escapeHtml(property.depositScheme)}. Reference: ${escapeHtml(property.depositRef)}.</p>
    <h4>5. Property care</h4><p>The tenant should report repairs promptly and take reasonable care of the property. The landlord is responsible for statutory safety and repair obligations.</p>
    <p class="small text-secondary border-top pt-3">This text is a sample preview only. It is not the complete agreement and is not legal advice.</p>
  </div>`;
}

function openContract(container, context, contract) {
  const sheet = openSheet(`${sheetHeader('Tenancy agreement', contract.title)}
    <div class="tenant-sheet-body">
      <span id="contractSignBadge"></span>
      ${agreementText(contract, context)}
      ${contract.status === 'sent' ? `<form id="contractApprovalForm" class="tenant-card mt-3"><h3 class="h6 fw-bold">Review and approve</h3><p class="small text-secondary">Your typed name records a demo approval only; no legal e-signature is collected.</p><div class="mb-3"><label class="form-label small fw-semibold" for="tenantSignatureName">Type your full name</label><input class="form-control" id="tenantSignatureName" name="signatureName" autocomplete="name" maxlength="100" required></div><div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="tenantAgreementConfirm" required><label class="form-check-label small" for="tenantAgreementConfirm">I have reviewed this sample agreement and wish to approve it.</label></div><button class="btn tenant-btn-primary w-100" type="submit">Approve agreement</button></form>` : `<div class="tenant-card mt-3"><span class="status-pill"><i class="bi bi-check-circle"></i>Approved ${contract.approvedOn ? formatDate(contract.approvedOn) : ''}</span><p class="small text-secondary mt-2 mb-0">This is a demo approval and does not represent a legally signed agreement.</p></div>`}
    </div>`);
  sheet.element.querySelector('#contractSignBadge').replaceWith(
    context.createNeedsLiveBadge('signatures', 'E-signature needs live system')
  );
  sheet.element.querySelector('#contractApprovalForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const record = context.data.contracts.find((item) =>
      item.id === contract.id && item.tenantId === context.tenant.id
    );
    if (!record || record.status !== 'sent') {
      context.toast('This agreement is no longer waiting for approval.', 'error');
      return;
    }
    const signer = new FormData(form).get('signatureName').trim();
    if (!signer || signer.toLowerCase() !== context.tenant.name.trim().toLowerCase()) {
      context.toast('Enter the tenant name on this account to confirm.', 'error');
      return;
    }
    record.status = 'approved';
    record.approvedOn = context.data.config.demoToday;
    const adminNotice = notificationEntry(context, 'admin', 'Tenant approved an agreement', `${context.tenant.name} approved ${record.title}.`, 'u-admin', 'contract');
    try {
      // These store writes become the contract, notification and audit API calls when a backend is introduced.
      context.save('contracts', context.data.contracts);
      context.save('notifications', [...context.data.notifications, adminNotice]);
      context.save('auditLog', [...context.data.auditLog, auditEntry(context, 'Approved', 'Contract', `${context.tenant.name} approved ${record.title} on ${formatDate(context.data.config.demoToday)}; e-signature is not collected in the demo.`)]);
      sheet.close();
      context.refresh();
      context.toast('Agreement approved in the demo');
    } catch (error) {
      context.toast(`Could not approve agreement: ${error.message}`, 'error');
    }
  });
}

export function renderContracts(container, context) {
  container.innerHTML = `<div class="page-enter"><h1 class="tenant-page-title">Contracts</h1><p class="tenant-page-subtitle">Review agreements sent by your landlord.</p><div class="d-flex align-items-center justify-content-between mb-2"><span class="small text-secondary">Tenancy agreements</span><span class="small text-secondary" id="tenantContractCount"></span></div><div id="tenantContractList"></div></div>`;
  renderRows(container, context);
  container.onclick = (event) => {
    const button = event.target.closest('[data-action="view-contract"]');
    if (!button) return;
    const contract = context.data.contracts.find((item) =>
      item.id === button.dataset.id && item.tenantId === context.tenant.id && item.status !== 'draft'
    );
    if (contract) openContract(container, context, contract);
  };
}
