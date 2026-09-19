/* Webook Bahagia application layer */
(() => {
  const cfg = window.BAHAGIA_CONFIG || {};
  const remote = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const sb = remote ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = id => document.getElementById(id);
  const toast = (message, error = false) => { const el = $('toast'); if (!el) return; el.textContent = message; el.className = `toast show${error ? ' error' : ''}`; setTimeout(() => el.className = 'toast', 3500); };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let authUser = null, profile = null, books = [], blocks = [];
  const localUsers = JSON.parse(localStorage.getItem('bahagia_users') || '{}');
  const localBooks = () => JSON.parse(localStorage.getItem('bahagia_books') || '[]');
  const localBlocks = () => JSON.parse(localStorage.getItem('bahagia_blocks') || '[]');
  const localSave = () => { localStorage.setItem('bahagia_books', JSON.stringify(books)); localStorage.setItem('bahagia_blocks', JSON.stringify(blocks)); };

  function showAuth() { $('app')?.classList.add('hidden'); $('authScreen')?.classList.remove('hidden'); }
  function showAdmin() { document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden')); $('admin')?.classList.remove('hidden'); }
  function renderUser() { const name = profile?.name || authUser?.email?.split('@')[0] || 'Pengguna'; $('userName').textContent = name; $('userRole').textContent = profile?.role === 'admin' ? 'Administrator' : 'Pengguna'; $('avatar').textContent = name[0].toUpperCase(); if (profile?.role === 'admin') showAdmin(); }
  function renderBooks() { const grid = $('bookGrid'); if (!grid) return; grid.innerHTML = books.length ? books.map((book, i) => `<article class="book-card"><div class="book-cover">▣</div><div><h3>${esc(book.title || book.name)}</h3><small>${esc(book.email || book.owner_email || '')}</small><button class="outline-btn" data-book="${i}">Buka</button></div></article>`).join('') : ''; $('emptyBooks')?.classList.toggle('hidden', books.length > 0); grid.querySelectorAll('[data-book]').forEach(button => button.onclick = () => openBook(books[Number(button.dataset.book)])); }
  function renderStats() { $('statBooks').textContent = books.length; $('statBlocks').textContent = blocks.length; $('statReaders').textContent = '0'; }
  function openBook(book) { if (book.url) window.open(book.url, '_blank', 'noopener'); else toast(`File ${book.title || book.name} tersimpan di storage.`); }

  async function loadProfile() { const { data, error } = await sb.from('profiles').select('id,email,name,role').eq('id', authUser.id).single(); if (error) throw error; profile = data; }
  async function loadRemoteData() {
    const query = profile.role === 'admin' ? sb.from('ebooks').select('*').order('created_at', { ascending: false }) : sb.from('ebooks').select('*').or(`owner_id.eq.${authUser.id},is_public.eq.true`).order('created_at', { ascending: false });
    const result = await query; if (result.error) throw result.error; books = result.data || [];
    const saved = await sb.from('builder_pages').select('blocks').eq('owner_id', authUser.id).order('updated_at', { ascending: false }).limit(1).maybeSingle(); if (!saved.error && saved.data?.blocks) blocks = saved.data.blocks;
    if (profile.role === 'admin') await loadAdmin();
  }
  async function loadAdmin() { const [{ count: users }, { count: ebookCount }, { data: settings }] = await Promise.all([sb.from('profiles').select('*', { count: 'exact', head: true }), sb.from('ebooks').select('*', { count: 'exact', head: true }), sb.from('site_settings').select('site_name,copyright_email').eq('id', 1).maybeSingle()]); $('adminUsers').textContent = users || 0; $('adminBooks').textContent = ebookCount || 0; if (settings) { $('siteName').value = settings.site_name || ''; $('copyrightEmail').value = settings.copyright_email || ''; } }
  async function enterApp() { if (remote) { await loadProfile(); await loadRemoteData(); } else { books = localBooks(); blocks = localBlocks(); profile = authUser; } $('authScreen').classList.add('hidden'); $('app').classList.remove('hidden'); renderUser(); renderBooks(); renderStats(); }

  async function signIn(email, password) { if (remote) { const { data, error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; authUser = data.user; } else { const found = localUsers[email]; if (!found || found.password !== password) throw Error('Email atau password salah.'); authUser = found; localStorage.setItem('bahagia_session', JSON.stringify(authUser)); } await enterApp(); toast('Selamat datang kembali.'); }
  async function signUp(email, password) { if (remote) { const { error } = await sb.auth.signUp({ email, password, options: { data: { name: email.split('@')[0] } } }); if (error) throw error; toast('Pendaftaran berhasil. Cek email konfirmasi.'); return; } if (localUsers[email]) throw Error('Email sudah terdaftar.'); const role = Object.keys(localUsers).length ? 'user' : 'admin'; localUsers[email] = { id: crypto.randomUUID(), email, password, name: email.split('@')[0], role }; localStorage.setItem('bahagia_users', JSON.stringify(localUsers)); await signIn(email, password); }
  $('emailForm')?.addEventListener('submit', async e => { e.preventDefault(); try { await signIn($('email').value.trim().toLowerCase(), $('password').value); } catch (error) { toast(error.message, true); } });
  $('signupBtn')?.addEventListener('click', async () => { try { await signUp($('email').value.trim().toLowerCase(), $('password').value); } catch (error) { toast(error.message, true); } });
  $('googleBtn')?.addEventListener('click', async () => { if (!remote) return toast('Isi config.js untuk mengaktifkan Google.', true); const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href.split('#')[0] } }); if (error) toast(error.message, true); });
  $('logoutBtn')?.addEventListener('click', async () => { if (remote) await sb.auth.signOut(); localStorage.removeItem('bahagia_session'); authUser = profile = null; showAuth(); });

  async function uploadFiles(files) { for (const file of [...files]) { if (file.size > 25 * 1024 * 1024) { toast(`${file.name} melebihi 25 MB.`, true); continue; } if (!remote) { books.push({ name: file.name, owner_email: authUser.email }); localSave(); continue; } const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'); const path = `${authUser.id}/${crypto.randomUUID()}-${safeName}`; const upload = await sb.storage.from(cfg.storageBucket || 'ebooks').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' }); if (upload.error) throw upload.error; const insert = await sb.from('ebooks').insert({ owner_id: authUser.id, title: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size, is_public: false }).select().single(); if (insert.error) throw insert.error; books.unshift(insert.data); } renderBooks(); renderStats(); toast('Upload ebook berhasil.'); }
  $('fileInput')?.addEventListener('change', async e => { try { await uploadFiles(e.target.files); e.target.value = ''; } catch (error) { toast(error.message, true); } });
  ['quickUpload','heroUpload','addBookBtn'].forEach(id => $(id)?.addEventListener('click', () => { location.hash = 'upload'; $('fileInput')?.click(); }));
  document.querySelectorAll('.tool').forEach(button => button.addEventListener('click', () => { blocks.push({ type: button.dataset.block, createdAt: Date.now() }); if (!remote) localSave(); renderStats(); toast('Blok ditambahkan.'); }));
  $('saveBuilder')?.addEventListener('click', async () => { try { if (remote) { const { error } = await sb.from('builder_pages').upsert({ owner_id: authUser.id, title: $('builderTitle')?.value || 'Untitled', blocks }, { onConflict: 'owner_id' }); if (error) throw error; } else localSave(); toast('Builder tersimpan.'); } catch (error) { toast(error.message, true); } });
  $('saveSettings')?.addEventListener('click', async () => { try { if (profile?.role !== 'admin') throw Error('Akses admin diperlukan.'); const { error } = await sb.from('site_settings').upsert({ id: 1, site_name: $('siteName').value, copyright_email: $('copyrightEmail').value, updated_by: authUser.id }, { onConflict: 'id' }); if (error) throw error; toast('Pengaturan disimpan.'); } catch (error) { toast(error.message, true); } });
  $('refreshAdmin')?.addEventListener('click', async () => { try { await loadAdmin(); toast('Data admin diperbarui.'); } catch (error) { toast(error.message, true); } });
  $('menuBtn')?.addEventListener('click', () => $('sidebar')?.classList.toggle('open'));
  document.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.style.display = 'none'; }));
  (async () => { try { if (remote) { const { data } = await sb.auth.getSession(); if (!data.session) return showAuth(); authUser = data.session.user; await enterApp(); } else { authUser = JSON.parse(localStorage.getItem('bahagia_session') || 'null'); authUser ? await enterApp() : showAuth(); } } catch (error) { showAuth(); toast(error.message, true); } })();
})();
