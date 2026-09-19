/* Webook Bahagia application layer */
(() => {
  const cfg = window.BAHAGIA_CONFIG || {};
  const hasSupabase = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const sb = hasSupabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = id => document.getElementById(id);
  const qs = s => document.querySelector(s);
  const toast = (message, error = false) => { const el = $('toast'); if (!el) return; el.textContent = message; el.className = `toast show${error ? ' error' : ''}`; setTimeout(() => el.className = 'toast', 3200); };
  const localUsers = JSON.parse(localStorage.getItem('bahagia_users') || '{}');
  let user = null, books = JSON.parse(localStorage.getItem('bahagia_books') || '[]'), blocks = JSON.parse(localStorage.getItem('bahagia_blocks') || '[]');
  const localSession = () => JSON.parse(localStorage.getItem('bahagia_session') || 'null');
  const save = () => { localStorage.setItem('bahagia_books', JSON.stringify(books)); localStorage.setItem('bahagia_blocks', JSON.stringify(blocks)); };
  const showApp = () => { $('authScreen')?.classList.add('hidden'); $('app')?.classList.remove('hidden'); renderUser(); renderBooks(); renderStats(); if (user?.role === 'admin') showAdmin(); };
  const showAuth = () => { $('app')?.classList.add('hidden'); $('authScreen')?.classList.remove('hidden'); };
  const renderUser = () => { const name = user?.name || user?.email?.split('@')[0] || 'Pengguna'; if ($('userName')) $('userName').textContent = name; if ($('userRole')) $('userRole').textContent = user?.role === 'admin' ? 'Administrator' : 'Pengguna'; if ($('avatar')) $('avatar').textContent = name[0].toUpperCase(); };
  const showAdmin = () => { document.querySelectorAll('.admin-only').forEach(x => x.classList.remove('hidden')); $('admin')?.classList.remove('hidden'); };
  const renderBooks = () => { const grid = $('bookGrid'); if (!grid) return; grid.innerHTML = books.length ? books.map((b, i) => `<article class="book-card"><div class="book-cover">▣</div><div><h3>${escapeHtml(b.name)}</h3><small>${escapeHtml(b.owner || user?.email || '')}</small><button class="outline-btn" data-book="${i}">Buka</button></div></article>`).join('') : ''; $('emptyBooks')?.classList.toggle('hidden', books.length > 0); grid.querySelectorAll('[data-book]').forEach(btn => btn.onclick = () => toast(`Membuka ${books[Number(btn.dataset.book)].name}`)); };
  const renderStats = () => { if ($('statBooks')) $('statBooks').textContent = books.length; if ($('statBlocks')) $('statBlocks').textContent = blocks.length; if ($('statReaders')) $('statReaders').textContent = '0'; if ($('statUsers')) $('statUsers').textContent = hasSupabase ? '—' : Object.keys(localUsers).length; };
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function signIn(email, password) {
    if (sb) { const { data, error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; user = { ...data.user, email }; }
    else { const found = localUsers[email]; if (!found || found.password !== password) throw Error('Email atau password salah.'); user = found; localStorage.setItem('bahagia_session', JSON.stringify(user)); }
    showApp(); toast('Selamat datang kembali.');
  }
  async function signUp(email, password) {
    if (sb) { const { error } = await sb.auth.signUp({ email, password }); if (error) throw error; toast('Pendaftaran berhasil. Cek email untuk konfirmasi lalu masuk.'); return; }
    if (localUsers[email]) throw Error('Email sudah terdaftar.'); const role = Object.keys(localUsers).length === 0 ? 'admin' : 'user'; localUsers[email] = { email, password, role, name: email.split('@')[0] }; localStorage.setItem('bahagia_users', JSON.stringify(localUsers)); toast(role === 'admin' ? 'Akun pertama otomatis menjadi admin.' : 'Akun berhasil dibuat.'); await signIn(email, password);
  }
  $('emailForm')?.addEventListener('submit', async e => { e.preventDefault(); try { await signIn($('email').value.trim().toLowerCase(), $('password').value); } catch (err) { toast(err.message, true); } });
  $('signupBtn')?.addEventListener('click', async () => { try { await signUp($('email').value.trim().toLowerCase(), $('password').value); } catch (err) { toast(err.message, true); } });
  $('googleBtn')?.addEventListener('click', async () => { if (!sb) return toast('Login Google belum aktif. Gunakan email/password atau isi config.js.', true); const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }); if (error) toast(error.message, true); });
  $('logoutBtn')?.addEventListener('click', async () => { if (sb) await sb.auth.signOut(); localStorage.removeItem('bahagia_session'); user = null; showAuth(); });
  const addFiles = files => { [...files].forEach(file => { if (file.size > 25 * 1024 * 1024) return toast(`${file.name} melebihi 25 MB.`, true); books.push({ name: file.name, owner: user?.email, createdAt: Date.now() }); }); save(); renderBooks(); renderStats(); toast('Ebook berhasil ditambahkan.'); };
  $('fileInput')?.addEventListener('change', e => addFiles(e.target.files));
  ['quickUpload','heroUpload','addBookBtn'].forEach(id => $(id)?.addEventListener('click', () => { location.hash = 'upload'; $('fileInput')?.click(); }));
  document.querySelectorAll('.tool').forEach(btn => btn.addEventListener('click', () => { blocks.push({ type: btn.dataset.block, createdAt: Date.now() }); save(); renderStats(); toast('Blok ditambahkan.'); }));
  $('saveBuilder')?.addEventListener('click', () => { save(); toast('Builder tersimpan.'); });
  $('menuBtn')?.addEventListener('click', () => $('sidebar')?.classList.toggle('open'));
  document.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.style.display = 'none'; }));
  if (sb) sb.auth.getSession().then(({ data }) => { if (data.session) { user = data.session.user; showApp(); } else showAuth(); }); else { user = localSession(); user ? showApp() : showAuth(); }
})();
