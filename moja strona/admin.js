/**
 * DyskiHub.pl — Panel administratora
 */

let selectedUser = null;

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function guardAdmin() {
  await window.DyskiAuth.initAuth();
  const user = window.DyskiAuth.getCurrentUser();

  if (!user) {
    window.location.href = 'index.html';
    return false;
  }

  if (!window.DyskiAuth.isAdminSession()) {
    showToast('Brak uprawnień administratora');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);
    return false;
  }

  document.getElementById('admin-subtitle').textContent = `Zalogowany jako ${user.email}`;
  return true;
}

function renderStats(stats) {
  if (!stats) return;
  document.getElementById('stat-users').textContent = stats.totalUsers.toLocaleString('pl-PL');
  document.getElementById('stat-tokens').textContent = stats.totalTokens.toLocaleString('pl-PL');
  document.getElementById('stat-today').textContent = stats.signupsToday.toLocaleString('pl-PL');
  document.getElementById('stat-week').textContent = stats.signupsWeek.toLocaleString('pl-PL');
  document.getElementById('admin-stats').hidden = false;
}

function renderUsers(users) {
  const tbody = document.getElementById('admin-users-body');
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="admin-table__empty">Brak użytkowników</td></tr>';
    return;
  }

  tbody.innerHTML = users
    .map(
      (u) => `
    <tr>
      <td>${escapeHtml(u.username)}${u.is_admin ? ' <span class="admin-badge">admin</span>' : ''}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>${(u.tokens || 0).toLocaleString('pl-PL')}</td>
      <td>${formatDate(u.created_at)}</td>
      <td>${u.banned ? '<span class="admin-badge admin-badge--ban">zablokowany</span>' : 'aktywny'}</td>
      <td><button type="button" class="btn btn--ghost btn--sm admin-grant-btn" data-user-id="${u.id}" data-username="${escapeHtml(u.username)}">Żetony</button></td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('.admin-grant-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedUser = { id: btn.dataset.userId, username: btn.dataset.username };
      document.getElementById('grant-target-name').textContent = selectedUser.username;
      document.getElementById('grant-amount').value = '';
      document.getElementById('admin-grant-panel').hidden = false;
      document.getElementById('grant-amount').focus();
    });
  });
}

function renderAudit(actions) {
  const list = document.getElementById('admin-audit-list');
  const panel = document.getElementById('admin-audit-panel');
  if (!list || !actions?.length) return;

  panel.hidden = false;
  list.innerHTML = actions
    .map(
      (a) => `
    <li class="admin-audit__item">
      <strong>${escapeHtml(a.admin_email)}</strong>
      ${a.action === 'grant_tokens' ? 'nadał' : 'odjął'}
      <strong>${Math.abs(a.amount)}</strong> żetonów
      <span class="admin-audit__time">${formatDate(a.created_at)}</span>
    </li>
  `
    )
    .join('');
}

async function loadUsers(search = '') {
  const tbody = document.getElementById('admin-users-body');
  tbody.innerHTML = '<tr><td colspan="6" class="admin-table__empty">Ładowanie…</td></tr>';

  try {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    const data = await window.DyskiAuth.adminFetch(`admin-list-users${qs}`);
    renderStats(data.stats);
    renderUsers(data.users);
    renderAudit(data.recentActions);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-table__empty">${escapeHtml(err.message)}</td></tr>`;
    if (err.message.includes('uprawnień') || err.message.includes('autoryzacji')) {
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);
    }
  }
}

async function submitGrant() {
  if (!selectedUser) return;

  const amount = parseInt(document.getElementById('grant-amount')?.value, 10);
  if (!Number.isFinite(amount) || amount === 0) {
    showToast('Wpisz ilość żetonów (różną od zera)');
    return;
  }

  try {
    const result = await window.DyskiAuth.adminFetch('admin-grant-tokens', {
      method: 'POST',
      body: JSON.stringify({ userId: selectedUser.id, amount }),
    });

    showToast(
      `${amount > 0 ? 'Dodano' : 'Odjęto'} ${Math.abs(amount)} żetonów dla ${selectedUser.username}. Nowe saldo: ${result.newTokens}`
    );

    document.getElementById('admin-grant-panel').hidden = true;
    selectedUser = null;
    await loadUsers(document.getElementById('admin-search')?.value.trim() || '');
  } catch (err) {
    showToast(err.message || 'Nie udało się nadać żetonów');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await guardAdmin();
  if (!ok) return;

  await loadUsers();

  document.getElementById('admin-search-btn')?.addEventListener('click', () => {
    loadUsers(document.getElementById('admin-search')?.value.trim() || '');
  });

  document.getElementById('admin-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      loadUsers(document.getElementById('admin-search')?.value.trim() || '');
    }
  });

  document.getElementById('grant-submit')?.addEventListener('click', submitGrant);
  document.getElementById('grant-cancel')?.addEventListener('click', () => {
    selectedUser = null;
    document.getElementById('admin-grant-panel').hidden = true;
  });

  document.getElementById('admin-logout')?.addEventListener('click', async () => {
    await window.DyskiAuth.signOut();
    window.location.href = 'index.html';
  });
});
