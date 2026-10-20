import { formatDate, daysBetween, parseISODate } from '../../data/helpers/date.js';
import { getDocumentStatus } from '../../data/helpers/status.js';
import { createNeedsLiveBadge } from '../components/needs-live-system.js';

const STATUS_LABELS = {
  valid: 'Valid',
  expiring: 'Expiring soon',
  expired: 'Expired'
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addMonths(dateValue, months) {
  const date = parseISODate(dateValue);
  const targetDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + Number(months));
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(targetDay, lastDay));
  return toISODate(date);
}

function badge(status) {
  const tone = { valid: 'success', expiring: 'warning', expired: 'danger' }[status] || 'secondary';
  return `<span class="badge text-bg-${tone} bg-opacity-10 text-${tone} border border-${tone} border-opacity-10">${STATUS_LABELS[status] || escapeHtml(status)}</span>`;
}

function auditRow(data, context, action, detail) {
  return {
    id: makeId('audit'),
    date: `${data.config.demoToday}T12:00:00`,
    userName: context.role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
    action,
    entity: 'Document',
    detail
  };
}

function getDocumentRows(data) {
  const properties = new Map(data.properties.map((property) => [property.id, property]));
  const tenants = new Map(data.tenants.map((tenant) => [tenant.id, tenant]));
  const types = new Map(data.documentTypes.map((type) => [type.id, type]));
  return data.documents.map((document) => ({
    ...document,
    computedStatus: getDocumentStatus(document, data.config),
    daysRemaining: daysBetween(data.config.demoToday, document.expiryDate),
    property: properties.get(document.propertyId),
    tenant: tenants.get(document.tenantId),
    typeName: types.get(document.type)?.name || document.type
  }));
}

function documentModal(data, document = null, scanMode = false) {
  const propertyId = document?.propertyId || '';
  const selectedType = document?.type || data.documentTypes[0]?.id;
  const issueDate = document?.issueDate || data.config.demoToday;
  const defaultType = data.documentTypes.find((type) => type.id === selectedType);
  const expiryDate = document?.expiryDate || (defaultType ? addMonths(issueDate, defaultType.renewalMonths) : '');
  return `
    <div class="modal fade" id="documentModal" tabindex="-1" aria-labelledby="documentModalTitle" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <form class="modal-content" id="documentForm" data-scan-mode="${scanMode}">
          <div class="modal-header"><div><h2 class="modal-title fs-5" id="documentModalTitle">${scanMode ? 'AI Scan certificate' : document ? 'Edit document' : 'Upload document'}</h2><p class="small text-secondary mb-0">${scanMode ? 'Simulated extraction is a suggestion. Review and confirm before saving.' : 'The demo records file names and metadata only.'}</p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label" for="documentProperty">Property</label><select class="form-select" id="documentProperty" name="propertyId" required><option value="">Choose property</option>${data.properties.map((property) => `<option value="${escapeHtml(property.id)}" ${property.id === propertyId ? 'selected' : ''}>${escapeHtml(property.name)} · ${escapeHtml(property.postcode)}</option>`).join('')}</select></div>
              <div class="col-md-6"><label class="form-label" for="documentTenant">Tenant (optional)</label><select class="form-select" id="documentTenant" name="tenantId"><option value="">Property-level document</option>${data.tenants.map((tenant) => `<option value="${escapeHtml(tenant.id)}" data-property-id="${escapeHtml(tenant.propertyId)}" ${tenant.id === document?.tenantId ? 'selected' : ''}>${escapeHtml(tenant.name)}</option>`).join('')}</select></div>
              <div class="col-md-6"><label class="form-label" for="documentType">Document type</label><select class="form-select" id="documentType" name="type" required>${data.documentTypes.map((type) => `<option value="${escapeHtml(type.id)}" data-renewal-months="${type.renewalMonths}" ${type.id === selectedType ? 'selected' : ''}>${escapeHtml(type.name)} · renew every ${type.renewalMonths} months</option>`).join('')}</select></div>
              <div class="col-md-6"><label class="form-label" for="documentFileName">File name</label><input class="form-control" id="documentFileName" name="fileName" required maxlength="160" placeholder="certificate.pdf" value="${escapeHtml(document?.fileName || '')}"></div>
              <div class="col-md-6"><label class="form-label" for="certificateNumber">Certificate number (optional)</label><input class="form-control" id="certificateNumber" name="certificateNumber" maxlength="80" value="${escapeHtml(document?.certificateNumber || '')}"></div>
              <div class="col-md-6"><label class="form-label" for="documentAddress">Address shown on document (optional)</label><input class="form-control" id="documentAddress" name="address" maxlength="180" value="${escapeHtml(document?.address || '')}"></div>
              <div class="col-md-6"><label class="form-label" for="documentIssueDate">Issue date</label><input class="form-control" id="documentIssueDate" name="issueDate" type="date" required value="${escapeHtml(issueDate)}"></div>
              <div class="col-md-6"><label class="form-label" for="documentExpiryDate">Expiry date</label><input class="form-control" id="documentExpiryDate" name="expiryDate" type="date" required value="${escapeHtml(expiryDate)}"><div class="form-text">Calculated from issue date and renewal interval; you can adjust it.</div></div>
            </div>
            ${scanMode ? `
              <div class="mt-3">
                <button class="btn btn-outline-secondary btn-sm" type="button" id="simulateDocumentScan"><i class="bi bi-stars me-1"></i>Simulate AI scan</button>
                <span class="ms-2">${createNeedsLiveBadge('ai').outerHTML}</span>
              </div>
              <div class="ai-review-box d-none mt-3" id="aiReviewBox">
                <div class="d-flex gap-2"><i class="bi bi-stars text-primary"></i><div><strong class="small">Suggested details ready for review</strong><p class="small text-secondary mb-2">Check the extracted values below. The suggestion will not be saved until you confirm it.</p><div id="aiConfidence" class="small"></div></div></div>
                <div class="form-check mt-3"><input class="form-check-input" type="checkbox" id="confirmAiSuggestion" required><label class="form-check-label small" for="confirmAiSuggestion">I have reviewed and confirm these suggested dates and document details.</label></div>
              </div>` : ''}
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-forest" id="saveDocumentButton" ${scanMode ? 'disabled' : ''}>${scanMode ? 'Confirm and save document' : document ? 'Save changes' : 'Save document'}</button></div>
        </form>
      </div>
    </div>`;
}

function filterTenantOptions(form) {
  const propertyId = form.elements.namedItem('propertyId').value;
  const tenantSelect = form.elements.namedItem('tenantId');
  for (const option of tenantSelect.options) {
    if (!option.value) continue;
    const matchingProperty = option.dataset.propertyId === propertyId;
    option.hidden = !matchingProperty;
    if (!matchingProperty && option.selected) tenantSelect.value = '';
  }
}

function updateExpiryFromIssueDate(form) {
  const typeOption = form.elements.namedItem('type').selectedOptions[0];
  const months = Number(typeOption.dataset.renewalMonths);
  const issueDate = form.elements.namedItem('issueDate').value;
  if (!issueDate || !Number.isFinite(months)) return;
  form.elements.namedItem('expiryDate').value = addMonths(issueDate, months);
}

function renderDocumentTable(container, data) {
  const query = container.querySelector('#documentSearch').value.trim().toLowerCase();
  const propertyFilter = container.querySelector('#documentPropertyFilter').value;
  const typeFilter = container.querySelector('#documentTypeFilter').value;
  const statusFilter = container.querySelector('#documentStatusFilter').value;
  const rows = getDocumentRows(data).filter((document) => {
    const haystack = `${document.fileName} ${document.typeName} ${document.property?.name || ''} ${document.tenant?.name || ''}`.toLowerCase();
    return haystack.includes(query)
      && (!propertyFilter || document.propertyId === propertyFilter)
      && (!typeFilter || document.type === typeFilter)
      && (!statusFilter || document.computedStatus === statusFilter);
  }).sort((a, b) => a.daysRemaining - b.daysRemaining);

  container.querySelector('#documentCount').textContent = `${rows.length} ${rows.length === 1 ? 'document' : 'documents'}`;
  container.querySelector('#documentResults').innerHTML = rows.length
    ? `<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Document</th><th>Property / tenant</th><th>Issue date</th><th>Expiry date</th><th>Status</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>${rows.map((document) => `<tr>
      <td><strong>${escapeHtml(document.typeName)}</strong><div class="small text-secondary">${escapeHtml(document.fileName)}</div></td>
      <td><a class="text-decoration-none" href="#/properties/${encodeURIComponent(document.propertyId)}">${escapeHtml(document.property?.name || 'Property')}</a><div class="small text-secondary">${escapeHtml(document.tenant?.name || 'Property document')}</div></td>
      <td>${formatDate(document.issueDate)}</td>
      <td>${formatDate(document.expiryDate)}<div class="small ${document.daysRemaining < 0 ? 'text-danger' : document.daysRemaining <= 30 ? 'text-warning' : 'text-secondary'}">${document.daysRemaining < 0 ? `${Math.abs(document.daysRemaining)} days overdue` : `${document.daysRemaining} days remaining`}</div></td>
      <td>${badge(document.computedStatus)}</td>
      <td class="text-end text-nowrap"><button class="btn btn-sm btn-light" data-action="edit-document" data-id="${escapeHtml(document.id)}" ${data.role === 'accountant' ? 'disabled' : ''} aria-label="Edit ${escapeHtml(document.typeName)}"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-secondary" data-action="send-reminder" data-id="${escapeHtml(document.id)}" ${data.role === 'accountant' || !document.tenant ? 'disabled title="A tenant must be linked to send a reminder."' : ''}>Remind</button></td>
    </tr>`).join('')}</tbody></table></div>`
    : '<div class="empty-state"><i class="bi bi-file-earmark-x"></i>No documents match these filters.</div>';
}

export function renderDocuments(container, context) {
  const canEdit = context.role !== 'accountant';
  const rows = getDocumentRows(context.data);
  const counts = {
    total: rows.length,
    valid: rows.filter((row) => row.computedStatus === 'valid').length,
    expiring: rows.filter((row) => row.computedStatus === 'expiring').length,
    expired: rows.filter((row) => row.computedStatus === 'expired').length
  };
  container.innerHTML = `
    <div class="page-header"><div><p class="page-eyebrow">Portfolio</p><h1 class="page-title">Documents</h1><p class="page-subtitle">Compliance and tenancy documents, with expiry status based on the demo date.</p></div><div class="d-flex gap-2">${canEdit ? `<button class="btn btn-light border" data-action="scan-document"><i class="bi bi-stars me-1"></i>AI Scan</button><button class="btn btn-forest" data-action="upload-document"><i class="bi bi-upload me-1"></i>Upload document</button>` : '<span class="small text-secondary">Read-only access</span>'}</div></div>
    <div class="row g-3 mb-3">
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Documents</div><div class="stat-value">${counts.total}</div><div class="stat-hint">Across the portfolio</div></div></div>
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Valid</div><div class="stat-value text-success">${counts.valid}</div><div class="stat-hint">Outside reminder window</div></div></div>
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Expiring soon</div><div class="stat-value text-warning">${counts.expiring}</div><div class="stat-hint">Within configured reminder days</div></div></div>
      <div class="col-6 col-xl-3"><div class="stat-card"><div class="stat-label">Expired</div><div class="stat-value text-danger">${counts.expired}</div><div class="stat-hint">Expiry date has passed</div></div></div>
    </div>
    <section class="panel-card">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3"><h2 class="h6 fw-bold mb-0">Document register</h2><span id="documentCount" class="small text-secondary"></span></div>
      <div class="row g-2 mb-3">
        <div class="col-lg-4"><label class="visually-hidden" for="documentSearch">Search documents</label><input class="form-control form-control-sm" id="documentSearch" type="search" placeholder="Search file, type or tenant"></div>
        <div class="col-6 col-lg-3"><label class="visually-hidden" for="documentPropertyFilter">Filter property</label><select class="form-select form-select-sm" id="documentPropertyFilter"><option value="">All properties</option>${context.data.properties.map((property) => `<option value="${escapeHtml(property.id)}">${escapeHtml(property.name)}</option>`).join('')}</select></div>
        <div class="col-6 col-lg-3"><label class="visually-hidden" for="documentTypeFilter">Filter type</label><select class="form-select form-select-sm" id="documentTypeFilter"><option value="">All document types</option>${context.data.documentTypes.map((type) => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.name)}</option>`).join('')}</select></div>
        <div class="col-12 col-lg-2"><label class="visually-hidden" for="documentStatusFilter">Filter status</label><select class="form-select form-select-sm" id="documentStatusFilter"><option value="">All statuses</option><option value="valid">Valid</option><option value="expiring">Expiring soon</option><option value="expired">Expired</option></select></div>
      </div>
      <div id="documentResults"></div>
      <p class="small text-secondary mt-3 mb-0">AI extraction is a simulated suggestion. Review extracted details before confirming.</p>
    </section>
    <div id="documentModalHost"></div>`;
  const update = () => renderDocumentTable(container, { ...context.data, role: context.role });
  for (const selector of ['#documentSearch', '#documentPropertyFilter', '#documentTypeFilter', '#documentStatusFilter']) {
    container.querySelector(selector).addEventListener(selector === '#documentSearch' ? 'input' : 'change', update);
  }
  update();
  if (!canEdit) return;

  container.onclick = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'upload-document' || button.dataset.action === 'scan-document') {
      openDocumentModal(container, context, button.dataset.action === 'scan-document');
    }
    if (button.dataset.action === 'edit-document') {
      const document = context.data.documents.find((item) => item.id === button.dataset.id);
      if (document) openDocumentModal(container, context, false, document);
    }
    if (button.dataset.action === 'send-reminder') {
      const document = context.data.documents.find((item) => item.id === button.dataset.id);
      if (document) sendDocumentReminder(document, context);
    }
  };
}

function openDocumentModal(container, context, scanMode, existingDocument = null) {
  const host = container.querySelector('#documentModalHost');
  host.innerHTML = documentModal(context.data, existingDocument, scanMode);
  const modalElement = host.querySelector('#documentModal');
  const form = host.querySelector('#documentForm');
  const propertySelect = form.elements.namedItem('propertyId');
  const issueDate = form.elements.namedItem('issueDate');
  const typeSelect = form.elements.namedItem('type');
  const expiryDate = form.elements.namedItem('expiryDate');
  const tenantSelect = form.elements.namedItem('tenantId');
  let expiryEdited = Boolean(existingDocument);

  filterTenantOptions(form);
  propertySelect.addEventListener('change', () => filterTenantOptions(form));
  typeSelect.addEventListener('change', () => {
    expiryEdited = false;
    updateExpiryFromIssueDate(form);
  });
  issueDate.addEventListener('change', () => {
    if (!expiryEdited) updateExpiryFromIssueDate(form);
  });
  expiryDate.addEventListener('input', () => { expiryEdited = true; });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (scanMode && !form.elements.namedItem('confirmAiSuggestion').checked) {
      context.toast('Review and confirm the AI suggestions before saving.', 'error');
      return;
    }
    saveDocument(form, context, existingDocument, scanMode, modalElement);
  });

  if (scanMode) {
    const reviewBox = form.querySelector('#aiReviewBox');
    const confirmBox = form.querySelector('#confirmAiSuggestion');
    const saveButton = form.querySelector('#saveDocumentButton');
    form.querySelector('#simulateDocumentScan').addEventListener('click', () => {
      if (!propertySelect.value || !typeSelect.value || !form.elements.namedItem('fileName').value.trim()) {
        context.toast('Choose a property and document type, then enter the file name before scanning.', 'error');
        return;
      }
      const issueSuggestion = addMonths(context.data.config.demoToday, -Number(typeSelect.selectedOptions[0].dataset.renewalMonths));
      const expirySuggestion = addMonths(issueSuggestion, Number(typeSelect.selectedOptions[0].dataset.renewalMonths));
      issueDate.value = issueSuggestion;
      expiryDate.value = expirySuggestion;
      const property = context.data.properties.find((item) => item.id === propertySelect.value);
      form.elements.namedItem('certificateNumber').value = 'GS-2026-0418';
      form.elements.namedItem('address').value = property ? `${property.address}, ${property.postcode}` : '';
      expiryEdited = false;
      reviewBox.classList.remove('d-none');
      form.querySelector('#aiConfidence').textContent = `Simulated extraction confidence: 94% · certificate GS-2026-0418 · address ${property ? `${property.address}, ${property.postcode}` : 'not recognised'}`;
      confirmBox.checked = false;
      saveButton.disabled = true;
      confirmBox.onchange = () => { saveButton.disabled = !confirmBox.checked; };
    });
  }

  window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

function saveDocument(form, context, existingDocument, scanned, modalElement) {
  const values = new FormData(form);
  const propertyId = values.get('propertyId');
  const tenantId = values.get('tenantId') || null;
  const property = context.data.properties.find((item) => item.id === propertyId);
  if (!property) {
    context.toast('Select a valid property before saving.', 'error');
    return;
  }
  if (tenantId && !context.data.tenants.some((tenant) => tenant.id === tenantId && tenant.propertyId === propertyId)) {
    context.toast('The selected tenant is not assigned to this property.', 'error');
    return;
  }
  if (values.get('expiryDate') < values.get('issueDate')) {
    context.toast('Expiry date cannot be earlier than issue date.', 'error');
    return;
  }

  const document = existingDocument || {
    id: makeId('doc'),
    propertyId,
    tenantId,
    type: values.get('type'),
    fileName: values.get('fileName').trim(),
    certificateNumber: values.get('certificateNumber').trim() || null,
    address: values.get('address').trim() || null,
    issueDate: values.get('issueDate'),
    expiryDate: values.get('expiryDate'),
    status: 'valid',
    uploadedBy: context.role === 'superadmin' ? 'u-admin' : 'u-manager',
    aiExtracted: Boolean(scanned),
    aiConfidence: scanned ? 0.94 : null
  };
  if (existingDocument) {
    Object.assign(document, {
      propertyId,
      tenantId,
      type: values.get('type'),
      fileName: values.get('fileName').trim(),
      certificateNumber: values.get('certificateNumber').trim() || null,
      address: values.get('address').trim() || null,
      issueDate: values.get('issueDate'),
      expiryDate: values.get('expiryDate')
    });
  }
  document.status = getDocumentStatus(document, context.data.config);
  if (!existingDocument) context.data.documents.push(document);
  try {
    // These store writes become the corresponding API calls when the shared JSON overlay is replaced.
    context.save('documents', context.data.documents);
    context.save('auditLog', [...context.data.auditLog, {
      id: makeId('audit'),
      date: `${context.data.config.demoToday}T12:00:00`,
      userName: context.role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
      action: existingDocument ? 'Updated' : 'Uploaded',
      entity: 'Document',
      detail: `${existingDocument ? 'Updated' : 'Added'} ${document.fileName} for ${property.name}${scanned ? ' after reviewing the AI suggestion' : ''}.`
    }]);
    window.bootstrap.Modal.getInstance(modalElement)?.hide();
    context.refresh();
    context.toast(`${document.fileName} ${existingDocument ? 'updated' : 'saved'}`);
  } catch (error) {
    context.toast(`Could not save document: ${error.message}`, 'error');
  }
}

function sendDocumentReminder(document, context) {
  const tenant = context.data.tenants.find((item) => item.id === document.tenantId)
    || context.data.tenants.find((item) => item.propertyId === document.propertyId && item.status === 'active');
  if (!tenant) {
    context.toast('No tenant is linked to this document or property.', 'error');
    return;
  }
  const type = context.data.documentTypes.find((item) => item.id === document.type)?.name || document.type;
  context.data.notifications.push({
    id: makeId('notification'),
    userId: tenant.userId,
    audience: 'tenant',
    title: 'Document expiry reminder',
    body: `${type} for your property expires on ${formatDate(document.expiryDate)}.`,
    type: 'document',
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
      entity: 'Document',
      detail: `In-app expiry reminder created for ${tenant.name} about ${type}.`
    }]);
    context.toast(`In-app reminder added for ${tenant.name}`);
  } catch (error) {
    context.toast(`Could not create reminder: ${error.message}`, 'error');
  }
}
