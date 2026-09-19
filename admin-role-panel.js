(() => {
  const cfg = window.BAHAGIA_CONFIG || {};
  const remote = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const containerId = 'roleUsersList';

  const toast = (message, error = false) => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.className = `toast show${error ? ' error' : ''}`;
    setTimeout(() => { el.className = 'toast'; }, 3500);
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const getClient = () => remote ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  const getCurrentSession = async () => {
    if (!remote) {
      const session = JSON.parse(localStorage.getItem('bahagia_session') || 'null');
      return session || null;
    }

    const client = getClient();
    const { data: sessionData } = await client.auth.getSession();
    return sessionData.session ? sessionData.session.user : null;
  };

  const ensureAdmin = async () => {
    const currentUser = await getCurrentSession();
    if (!currentUser) {
      window.location.replace('index.html');
      return null;
    }

    if (!remote) {
      return currentUser.role === 'admin' ? currentUser : null;
    }

    const client = getClient();
    const { data, error } = await client
      .from('profiles')
      .select('role,id')
      .eq('id', currentUser.id)
      .single();

    if (error || !data || data.role !== 'admin') {
      window.location.replace('index.html');
      return null;
    }

    return data;
  };

  const renderUsers = async () => {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      const client = getClient();
      const currentUser = await getCurrentSession();
      if (!client || !currentUser) throw new Error('Sesi tidak ditemukan.');

      const { data, error } = await client
        .from('profiles')
        .select('id,email,name,role,created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      container.innerHTML = (data || []).map(user => {
        const displayName = user.name || user.email || 'Pengguna';
        const disabled = currentUser.id === user.id ? 'disabled' : '';

        return `
          <div class="role-user">
            <div class="role-user-info">
              <strong>${esc(displayName)}</strong>
              <small>${esc(user.email || '')}</small>
            </div>
            <select data-role-user="${user.id}" ${disabled}>
              <option value="user" ${user.role === 'user' ? 'selected' : ''}>Pengguna</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </div>
        `;
      }).join('') || '<span class="muted">Belum ada pengguna.</span>';

      container.querySelectorAll('select[data-role-user]').forEach(select => {
        select.addEventListener('change', async (event) => {
          const userId = event.target.dataset.roleUser;
          const nextRole = event.target.value;
          const isSelf = currentUser.id === userId;

          if (isSelf && nextRole !== 'admin') {
            toast('Admin aktif tidak dapat menurunkan role dirinya sendiri.', true);
            event.target.value = 'admin';
            return;
          }

          event.target.disabled = true;
          try {
            const { error: updateError } = await client
              .from('profiles')
              .update({ role: nextRole })
              .eq('id', userId);

            if (updateError) throw updateError;

            toast(`Role berhasil diubah menjadi ${nextRole === 'admin' ? 'Admin' : 'Pengguna'}.`);
            await renderUsers();
          } catch (error) {
            toast(error.message || 'Gagal mengubah role pengguna.', true);
            event.target.disabled = false;
          }
        });
      });
    } catch (error) {
      container.innerHTML = '<span class="muted">Tidak dapat memuat pengguna.</span>';
      toast(error.message || 'Gagal memuat daftar pengguna.', true);
    }
  };

  const init = async () => {
    const admin = await ensureAdmin();
    if (!admin) return;
    await renderUsers();
  };

  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
