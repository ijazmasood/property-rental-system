import { daysBetween, formatDate, parseISODate } from '../../data/helpers/date.js';
import { getDocumentStatus } from '../../data/helpers/status.js';
import { auditEntry, escapeHtml, makeId, notificationEntry, openSheet, sheetHeader } from './shared.js';

function statusBadge(status) {
  const tone = status === 'expired' ? 'danger' : status === 'expiring' ? 'warning' : '';
  const label = status === 'valid' ? 'Valid' : status === 'expiring' ? 'Expiring soon' : 'Expired';
  return `<span class="status-pill ${tone}">${label}</span>`;
}

function addMonths(value, months) {
  const date = parseISODate(value);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + Number(months));
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function renderDocumentRows(container, context) {
  const typeNames = new Map(context.data.documentTypes.map((type) => [type.id, type.name]));
  const uploaded = context.data.documents.filter((document) =>
    document.tenantId === context.tenant.id && document.uploadedBy === context.tenant.userId
  ).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const propertyDocuments = context.data.documents.filter((document) =>
    document.propertyId === context.property.id
    && (!document.tenantId || (document.tenantId === context.tenant.id && document.uploadedBy !== context.tenant.userId))
  ).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  container.querySelector('#uploadedDocumentCount').textContent = String(uploaded.length);
  container.querySelector('#tenantUploadedDocuments').innerHTML = uploaded.length
    ? uploaded.map((document) => {
      const status = getDocumentStatus(document, context.data.config);
      return `<article class="tenant-card document-row mb-2"><span class="document-type-icon"><i class="bi bi-file-earmark-person"></i></span><div class="document-info"><strong>${escapeHtml(typeNames.get(document.type) || document.type)}</strong><span>${escapeHtml(document.fileName)}</span><small>Added ${formatDate(document.issueDate)}</small></div>${statusBadge(status)}</article>`;
    }).join('')
    : `<section class="tenant-card"><div class="empty-state"><i class="bi bi-cloud-arrow-up"></i>No personal documents uploaded yet.</div></section>`;
  container.querySelector('#sharedPropertyDocuments').innerHTML = propertyDocuments.length
    ? propertyDocuments.map((document) => {
      const status = getDocumentStatus(document, context.data.config);
      const days = daysBetween(context.data.config.demoToday, document.expiryDate);
      return `<article class="tenant-card document-row mb-2"><span class="document-type-icon"><i class="bi bi-shield-check"></i></span><div class="document-info"><strong>${escapeHtml(typeNames.get(document.type) || document.type)}</strong><span>${escapeHtml(document.fileName)}</span><small>Expires ${formatDate(document.expiryDate)}${status === 'expiring' ? ` · ${Math.max(0, days)} days left` : ''}</small></div>${statusBadge(status)}</article>`;
    }).join('')
    : `<section class="tenant-card"><div class="empty-state"><i class="bi bi-folder2-open"></i>No property certificates have been shared yet.</div></section>`;
}

function openUploadSheet(container, context) {
  const defaultType = context.data.documentTypes.find((type) => type.id === 'right-to-rent')?.id || context.data.documentTypes[0]?.id;
  const sheet = openSheet(`${sheetHeader('Upload a document', 'Add a document to your tenant file')}
    <div class="tenant-sheet-body">
      <button class="live-badge-static" type="button" data-live-feature="storage"><i class="bi bi-cloud-lock"></i>Secure file storage needs live system</button>
      <form id="tenantDocumentForm" class="mt-3">
        <div class="mb-3"><label class="form-label small fw-semibold" for="tenantDocumentType">Document type</label><select class="form-select" id="tenantDocumentType" name="type" required>${context.data.documentTypes.map((type) => `<option value="${escapeHtml(type.id)}" ${type.id === defaultType ? 'selected' : ''}>${escapeHtml(type.name)}</option>`).join('')}</select></div>
        <div class="mb-3"><label class="form-label small fw-semibold" for="tenantDocumentFile">Choose a file</label><input class="form-control" id="tenantDocumentFile" type="file" required accept=".pdf,.jpg,.jpeg,.png"><div class="form-text">The demo records file name and metadata only. No file content is uploaded.</div></div>
        <div id="tenantDocumentFileName" class="small text-secondary mb-3"></div>
        <button class="btn tenant-btn-primary w-100" type="submit">Add to my documents</button>
      </form>
    </div>`);
  const file = sheet.element.querySelector('#tenantDocumentFile');
  file.addEventListener('change', () => {
    sheet.element.querySelector('#tenantDocumentFileName').textContent = file.files?.[0]?.name || '';
  });
  sheet.element.querySelector('#tenantDocumentForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const selectedFile = file.files?.[0];
    if (!selectedFile) {
      context.toast('Choose a file to continue.', 'error');
      return;
    }
    const documentType = context.data.documentTypes.find((type) => type.id === form.elements.namedItem('type').value);
    if (!documentType) {
      context.toast('Choose a valid document type.', 'error');
      return;
    }
    const document = {
      id: makeId('doc'),
      propertyId: context.tenant.propertyId,
      tenantId: context.tenant.id,
      type: documentType.id,
      fileName: selectedFile.name,
      issueDate: context.data.config.demoToday,
      expiryDate: addMonths(context.data.config.demoToday, documentType.renewalMonths),
      status: 'valid',
      uploadedBy: context.tenant.userId,
      aiExtracted: false,
      aiConfidence: null
    };
    const notice = notificationEntry(context, 'admin', 'Tenant uploaded a document', `${context.tenant.name} uploaded ${selectedFile.name}.`, 'u-admin', 'document');
    try {
      // These store writes become the tenant document, notification and audit API calls when a backend is introduced.
      context.save('documents', [...context.data.documents, document]);
      context.save('notifications', [...context.data.notifications, notice]);
      context.save('auditLog', [...context.data.auditLog, auditEntry(context, 'Uploaded', 'Document', `${context.tenant.name} added ${selectedFile.name} (${documentType.name}) to their tenant file.`)]);
      sheet.close();
      context.refresh();
      context.toast('Document added to your tenant file');
    } catch (error) {
      context.toast(`Could not add document: ${error.message}`, 'error');
    }
  });
}

export function renderDocuments(container, context) {
  container.innerHTML = `<div class="page-enter"><div class="d-flex justify-content-between align-items-start gap-2"><div><h1 class="tenant-page-title">Documents</h1><p class="tenant-page-subtitle">Your files and property certificates.</p></div><button class="btn btn-sm tenant-btn-primary" type="button" data-action="upload-document"><i class="bi bi-upload me-1"></i>Upload</button></div>
    <div class="document-section-heading"><h2>My documents</h2><span class="small text-secondary"><span id="uploadedDocumentCount">0</span> files</span></div>
    <div id="tenantUploadedDocuments"></div>
    <div class="document-section-heading mt-4"><h2>Property certificates</h2><i class="bi bi-shield-check text-success" aria-hidden="true"></i></div>
    <p class="small text-secondary mt-0">Shared by your landlord for ${escapeHtml(context.property.name)}.</p><div id="sharedPropertyDocuments"></div>
  </div>`;
  renderDocumentRows(container, context);
  container.querySelector('[data-action="upload-document"]').addEventListener('click', () => openUploadSheet(container, context));
}
