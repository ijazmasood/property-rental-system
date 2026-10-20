const USER_ROLES = ['superadmin', 'admin', 'accountant', 'tenant'];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function inviteModal() {
  return `<div class="modal fade" id="inviteUserModal" tabindex="-1" aria-labelledby="inviteUserTitle" aria-hidden="true"><div class="modal-dialog"><form class="modal-content" id="inviteUserForm">
    <div class="modal-header"><div><h2 class="modal-title fs-5" id="inviteUserTitle">Invite a team member</h2><p class="small text-secondary mb-0">Creates a demo user record; no email is sent.</p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
    <div class="modal-body"><div class="mb-3"><label class="form-label" for="inviteName">Full name</label><input class="form-control" id="inviteName" name="name" required maxlength="100"></div><div class="mb-3"><label class="form-label" for="inviteEmail">Email address</label><input class="form-control" id="inviteEmail" name="email" type="email" required maxlength="160"></div><div class="mb-3"><label class="form-label" for="invitePhone">Phone (optional)</label><input class="form-control" id="invitePhone" name="phone" type="tel" maxlength="30" placeholder="07700 900000"></div><div><label class="form-label" for="inviteRole">Role</label><select class="form-select" id="inviteRole" name="role">${USER_ROLES.map((role) => `<option value="${role}">${role === 'superadmin' ? 'Super admin' : role[0].toUpperCase() + role.slice(1)}</option>`).join('')}</select></div></div>
    <div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-forest">Create demo user</button></div>
  </form></div></div>`;
}

function renderUserRows(container, data, role) {
  container.querySelector('#userRows').innerHTML = data.users.map((user) => `<tr><td><strong>${escapeHtml(user.name)}</strong><div class="small text-secondary">${escapeHtml(user.email)}</div></td><td>${escapeHtml(user.phone || '—')}</td><td>${role === 'accountant' ? `<span class="badge bg-light text-secondary">${escapeHtml(user.role)}</span>` : `<label class="visually-hidden" for="userRole-${escapeHtml(user.id)}">Role for ${escapeHtml(user.name)}</label><select class="form-select form-select-sm" id="userRole-${escapeHtml(user.id)}" data-user-role="${escapeHtml(user.id)}" ${user.role === 'superadmin' ? 'disabled title="The primary super admin role is fixed in this demo."' : ''}>${USER_ROLES.map((item) => `<option value="${item}" ${item === user.role ? 'selected' : ''}>${item === 'superadmin' ? 'Super admin' : item[0].toUpperCase() + item.slice(1)}</option>`).join('')}</select>`}</td><td><span class="badge ${user.status === 'active' ? 'text-bg-success bg-opacity-10 text-success' : 'text-bg-warning bg-opacity-10 text-warning'}">${escapeHtml(user.status)}</span></td><td>${role !== 'accountant' && user.role !== 'superadmin' ? `<button class="btn btn-sm btn-light" data-action="save-role" data-id="${escapeHtml(user.id)}">Save role</button>` : ''}</td></tr>`).join('');
}

export function renderUsers(container, context) {
  const canManage = context.role !== 'accountant';
  container.innerHTML = `<div class="page-header"><div><p class="page-eyebrow">Administration</p><h1 class="page-title">Users and Roles</h1><p class="page-subtitle">Demo users and the permission boundaries planned for the live service.</p></div><div class="d-flex align-items-center gap-2">${canManage ? '<button class="btn btn-forest" data-action="invite"><i class="bi bi-person-plus me-1"></i>Invite user</button>' : '<span class="small text-secondary">Read-only access</span>'}<span id="authBadge"></span></div></div>
    <section class="panel-card mb-3"><div class="d-flex justify-content-between gap-2 align-items-start mb-3"><div><h2 class="h6 fw-bold mb-1">Users</h2><p class="small text-secondary mb-0">This static demo does not authenticate these accounts or enforce roles on a server.</p></div></div><div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>User</th><th>Phone</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody id="userRows"></tbody></table></div></section>
    <section class="panel-card"><h2 class="h6 fw-bold mb-1">Permissions matrix</h2><p class="small text-secondary mb-3">Reference matrix for the backend policy. UI role switching is only a demonstration.</p><div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Capability</th><th>Super admin</th><th>Admin</th><th>Accountant</th><th>Tenant</th></tr></thead><tbody>
      <tr><td>View portfolio and reports</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Own tenancy only</td></tr><tr><td>Manage tenants, properties and requests</td><td>Yes</td><td>Yes</td><td>No</td><td>No</td></tr><tr><td>Record bills, rent and ledger changes</td><td>Yes</td><td>Yes</td><td>No</td><td>Own payment flow only</td></tr><tr><td>Manage users and roles</td><td>Yes</td><td>Limited</td><td>No</td><td>No</td></tr><tr><td>View and update own issues</td><td>Yes</td><td>Yes</td><td>Read only</td><td>Own issues only</td></tr>
    </tbody></table></div></section><div id="userModalHost"></div>`;
  container.querySelector('#authBadge').replaceWith(context.createNeedsLiveBadge('authentication', 'Login and MFA need live system'));
  renderUserRows(container, context.data, context.role);
  if (!canManage) return;
  container.onclick = (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'invite') openInviteModal(container, context);
    if (button.dataset.action === 'save-role') {
      const user = context.data.users.find((item) => item.id === button.dataset.id);
      const selection = container.querySelector(`[data-user-role="${CSS.escape(button.dataset.id)}"]`);
      if (!user || !selection || !USER_ROLES.includes(selection.value)) return;
      if (user.role === selection.value) {
        context.toast('No role change to save.', 'info');
        return;
      }
      const oldRole = user.role;
      user.role = selection.value;
      try {
        // These store writes become the user-role and audit API calls when a backend is introduced.
        context.save('users', context.data.users);
        context.save('auditLog', [...context.data.auditLog, {
          id: makeId('audit'),
          date: `${context.data.config.demoToday}T12:00:00`,
          userName: context.role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
          action: 'Changed role',
          entity: 'User',
          detail: `${user.name} role changed from ${oldRole} to ${user.role}.`
        }]);
        context.refresh();
        context.toast(`${user.name} role updated`);
      } catch (error) {
        context.toast(`Could not update role: ${error.message}`, 'error');
      }
    }
  };
}

function openInviteModal(container, context) {
  const host = container.querySelector('#userModalHost');
  host.innerHTML = inviteModal();
  const modalElement = host.querySelector('#inviteUserModal');
  const form = host.querySelector('#inviteUserForm');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const email = values.get('email').trim().toLowerCase();
    if (context.data.users.some((user) => user.email.toLowerCase() === email)) {
      context.toast('A user with this email address already exists.', 'error');
      return;
    }
    const user = {
      id: makeId('user'),
      name: values.get('name').trim(),
      email,
      role: values.get('role'),
      phone: values.get('phone').trim(),
      status: 'invited'
    };
    context.data.users.push(user);
    context.data.notifications.push({
      id: makeId('notification'),
      userId: context.role === 'superadmin' ? 'u-admin' : 'u-manager',
      audience: 'admin',
      title: 'Demo user invited',
      body: `${user.name} was added as ${user.role}. No invitation email was sent.`,
      type: 'system',
      createdOn: context.data.config.demoToday,
      read: false
    });
    try {
      // These store writes become the user invitation and notification API calls when a backend is introduced.
      context.save('users', context.data.users);
      context.save('notifications', context.data.notifications);
      context.save('auditLog', [...context.data.auditLog, {
        id: makeId('audit'),
        date: `${context.data.config.demoToday}T12:00:00`,
        userName: context.role === 'superadmin' ? 'Helen Foster' : 'Martin Cole',
        action: 'Invited',
        entity: 'User',
        detail: `${user.name} (${user.email}) added with ${user.role} role; invitation delivery is not connected.`
      }]);
      window.bootstrap.Modal.getInstance(modalElement)?.hide();
      context.refresh();
      context.toast(`${user.name} added as an invited demo user`);
    } catch (error) {
      context.toast(`Could not invite user: ${error.message}`, 'error');
    }
  });
  window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
}
