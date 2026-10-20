export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

export function auditEntry(context, action, entity, detail) {
  return {
    id: makeId('audit'),
    date: `${context.data.config.demoToday}T12:00:00`,
    userName: context.tenant.name,
    action,
    entity,
    detail
  };
}

export function notificationEntry(context, audience, title, body, userId = null, type = 'system') {
  return {
    id: makeId('notification'),
    userId,
    audience,
    title,
    body,
    type,
    createdOn: context.data.config.demoToday,
    read: false
  };
}

export function openSheet(content, onClose = () => {}) {
  document.querySelector('#activeTenantSheet')?.querySelector('[data-sheet-dismiss-button]')?.click();
  const screen = document.querySelector('.phone-screen');
  const wrapper = document.createElement('div');
  wrapper.id = 'activeTenantSheet';
  wrapper.className = 'tenant-sheet-layer';
  wrapper.innerHTML = `<div class="tenant-sheet-backdrop" data-sheet-dismiss></div><section class="offcanvas offcanvas-bottom tenant-sheet" tabindex="-1" aria-modal="true" aria-labelledby="tenantSheetTitle">${content}</section>`;
  screen.append(wrapper);

  let closed = false;
  const panel = wrapper.querySelector('.tenant-sheet');
  const instance = window.bootstrap.Offcanvas.getOrCreateInstance(panel, {
    backdrop: false,
    keyboard: true,
    scroll: true
  });
  const finishClose = () => {
    wrapper.remove();
    document.removeEventListener('keydown', onKeydown);
    onClose();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    instance.hide();
  };
  panel.addEventListener('hidden.bs.offcanvas', finishClose, { once: true });
  const onKeydown = (event) => {
    if (event.key === 'Escape') close();
  };
  wrapper.addEventListener('click', (event) => {
    if (event.target.closest('[data-sheet-dismiss], [data-sheet-dismiss-button]')) close();
  });
  document.addEventListener('keydown', onKeydown);
  instance.show();
  requestAnimationFrame(() => wrapper.querySelector('input, select, textarea, button')?.focus());
  return { element: wrapper, close, instance };
}

export function sheetHeader(title, subtitle = '') {
  return `<div class="tenant-sheet-header"><div><h2 class="h5 fw-bold mb-1" id="tenantSheetTitle">${escapeHtml(title)}</h2>${subtitle ? `<p class="small text-secondary mb-0">${escapeHtml(subtitle)}</p>` : ''}</div><button type="button" class="topbar-icon" data-sheet-dismiss-button aria-label="Close"><i class="bi bi-x-lg"></i></button></div>`;
}
