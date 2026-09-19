/* Admin-only user role management. Authorization is enforced by Supabase RLS. */
(() => {
  'use strict';

  const cfg = window.BAHAGIA_CONFIG || {};
  const ready = callback => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
    else callback();
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const notify = (message, error = false) => {
    const toast = document.querySelector('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show${error ? ' error' : ''}`;
    window.clearTimeout(toast._hideTimer);
    toast._hideTimer = window.setTimeout(() => { toast.className = 'toast'; }, 3500);
  };

  ready(async () => {
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return;

    const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) return;

    const { data: me } = await client.from('profiles').select('role').eq('id', sessionData.session.user.id).single();
    if (!me || me.role !== 'admin') return;

    const adminSection = document.querySelector('#admin');
    const adminGrid = adminSection?.querySelector('.admin-grid');
    if (!adminGrid) return;

    const ensureCard = (id, title, helper, contentId) => {
      let card = document.querySelector(`#${id}`);
      if (!card) {
        card = document.createElement('div');
        card.id = id;
        card.className = 'admin-card';
        card.innerHTML = `<h3>${title}</h3><p class="muted">${helper}</p><div class="admin-list" id="${contentId}"></div>`;
        adminGrid.appendChild(card);
      }
      return card;
    };

    ensureCard('adminUsersCard', 'Kelola Pengguna', 'Ubah role pengguna. Perubahan divalidasi oleh RLS di database.', 'roleUsers');
    ensureCard('adminEbooksCard', 'Kelola Ebook', 'Ubah status publik dan hapus ebook dari semua pengguna.', 'ebookAdminList');

    const loadUsers = async () => {
      const container = document.querySelector('#roleUsers');
      if (!container) return;

      const { data, error } = await client.from('profiles').select('id,email,name,role,created_at').order('created_at', { ascending: true });
      if (error) {
        notify(error.message, true);
        return;
      }

      container.innerHTML = (data || []).length
        ? (data || []).map(user => `
          <div class="role-user">
            <div>
              <strong>${esc(user.name || user.email || 'Pengguna')}</strong>
              <small>${esc(user.email || '')}</small>
            </div>
            <select data-role-user="${user.id}" aria-label="Ubah role ${esc(user.email || 'pengguna')}">
              <option value="user" ${user.role === 'user' ? 'selected' : ''}>Pengguna</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </div>
        `).join('')
        : '<p class="muted">Belum ada pengguna.</p>';

      container.querySelectorAll('[data-role-user]').forEach(select => {
        select.addEventListener('change', async event => {
          const id = event.target.dataset.roleUser;
          const role = event.target.value;
          event.target.disabled = true;

          try {
            const { error: updateError } = await client.from('profiles').update({ role }).eq('id', id);
            if (updateError) throw updateError;
            notify(`Role berhasil diubah menjadi ${role === 'admin' ? 'Admin' : 'Pengguna'}.`);
            await loadUsers();
          } catch (error) {
            notify(error.message || 'Gagal mengubah role pengguna.', true);
            event.target.disabled = false;
          }
        });
      });
    };

    const loadEbooks = async () => {
      const list = document.querySelector('#ebookAdminList');
      if (!list) return;

      const [{ data: profiles, error: profilesError }, { data: ebooks, error: booksError }] = await Promise.all([
        client.from('profiles').select('id,email,name'),
        client.from('ebooks').select('*').order('created_at', { ascending: false })
      ]);

      if (profilesError || booksError) {
        notify((profilesError || booksError)?.message || 'Gagal memuat ebook.', true);
        return;
      }

      const ownerMap = new Map((profiles || []).map(profile => [profile.id, profile]));

      list.innerHTML = (ebooks || []).length
        ? (ebooks || []).map(book => {
            const owner = ownerMap.get(book.owner_id);
            const ownerLabel = owner?.email || 'Tidak dikenal';
            const isPublic = Boolean(book.is_public);
            return `
              <div class="ebook-admin-item">
                <div class="ebook-admin-meta">
                  <strong>${esc(book.title || 'Judul ebook')}</strong>
                  <small>${esc(ownerLabel)}</small>
                </div>
                <div class="ebook-admin-badges">
                  <span class="status-badge ${isPublic ? 'public' : 'private'}">${isPublic ? 'Publik' : 'Pribadi'}</span>
                </div>
                <div class="ebook-admin-actions">
                  <button class="outline-btn small" data-ebook-toggle="${book.id}" data-public="${String(isPublic)}">${isPublic ? 'Jadikan Pribadi' : 'Jadikan Publik'}</button>
                  <button class="text-btn small danger" data-ebook-delete="${book.id}">Hapus</button>
                </div>
              </div>
            `;
          }).join('')
        : '<p class="muted">Belum ada ebook.</p>';

      list.querySelectorAll('[data-ebook-toggle]').forEach(button => {
        button.addEventListener('click', async event => {
          const id = event.currentTarget.dataset.ebookToggle;
          const nextValue = event.currentTarget.dataset.public !== 'true';
          event.currentTarget.disabled = true;

          try {
            const { error: updateError } = await client.from('ebooks').update({ is_public: nextValue }).eq('id', id);
            if (updateError) throw updateError;
            notify(`Status ebook berhasil diubah menjadi ${nextValue ? 'Publik' : 'Pribadi'}.`);
            await loadEbooks();
          } catch (error) {
            notify(error.message || 'Gagal mengubah status ebook.', true);
            event.currentTarget.disabled = false;
          }
        });
      });

      list.querySelectorAll('[data-ebook-delete]').forEach(button => {
        button.addEventListener('click', async event => {
          const id = event.currentTarget.dataset.ebookDelete;
          if (!window.confirm('Hapus ebook ini dari platform?')) return;

          try {
            const { data: storageBook, error: storageError } = await client.from('ebooks').select('storage_path').eq('id', id).single();
            if (storageError) throw storageError;
            if (storageBook?.storage_path) {
              const { error: removeError } = await client.storage.from(cfg.storageBucket || 'ebooks').remove([storageBook.storage_path]);
              if (removeError) throw removeError;
            }

            const { error: deleteError } = await client.from('ebooks').delete().eq('id', id);
            if (deleteError) throw deleteError;

            notify('Ebook berhasil dihapus.');
            await loadEbooks();
          } catch (error) {
            notify(error.message || 'Gagal menghapus ebook.', true);
          }
        });
      });
    };

    await loadUsers();
    await loadEbooks();
  });
})();

