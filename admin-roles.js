/* Admin-only user role management. Authorization is enforced by Supabase RLS. */
(() => {
  const cfg = window.BAHAGIA_CONFIG || {};
  const ready = callback => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
    else callback();
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  ready(async () => {
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return;
    const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) return;

    const { data: me } = await client.from('profiles').select('role').eq('id', sessionData.session.user.id).single();
    if (!me || me.role !== 'admin') return;

    const adminSection = document.querySelector('#admin');
    const adminGrid = adminSection?.querySelector('.admin-grid');
    if (!adminGrid || document.querySelector('#adminUsersCard')) return;

    const card = document.createElement('div');
    card.id = 'adminUsersCard';
    card.className = 'admin-card admin-users-card';
    card.innerHTML = `<h3>Kelola Pengguna</h3><p class="muted">Ubah role pengguna. Perubahan divalidasi oleh RLS di database.</p><div id="roleUsers" class="role-users"><span class="muted">Memuat pengguna...</span></div>`;
    adminGrid.appendChild(card);

    const notify = (message, error = false) => {
      const toast = document.querySelector('#toast');
      if (!toast) return;
      toast.textContent = message;
      toast.className = `toast show${error ? ' error' : ''}`;
      setTimeout(() => { toast.className = 'toast'; }, 3500);
    };

    const loadUsers = async () => {
      const container = document.querySelector('#roleUsers');
      const { data, error } = await client.from('profiles').select('id,email,name,role,created_at').order('created_at', { ascending: true });
      if (error) { notify(error.message, true); return; }
      container.innerHTML = (data || []).map(user => `<div class="role-user"><div><strong>${esc(user.name || user.email || 'Pengguna')}</strong><small>${esc(user.email || '')}</small></div><select data-role-user="${user.id}" ${user.id === sessionData.session.user.id ? 'disabled' : ''}><option value="user" ${user.role === 'user' ? 'selected' : ''}>Pengguna</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option></select></div>`).join('') || '<span class="muted">Belum ada pengguna.</span>';
      container.querySelectorAll('[data-role-user]').forEach(select => select.addEventListener('change', async event => {
        const id = event.target.dataset.roleUser;
        const role = event.target.value;
        event.target.disabled = true;
        const { error: updateError } = await client.from('profiles').update({ role }).eq('id', id);
        event.target.disabled = false;
        if (updateError) { notify(updateError.message, true); await loadUsers(); return; }
        notify(`Role berhasil diubah menjadi ${role === 'admin' ? 'Admin' : 'Pengguna'}.`);
        await loadUsers();
      }));
    };

    await loadUsers();
  });
})();
