/* Webook Bahagia application layer */
(() => {
  const cfg = window.BAHAGIA_CONFIG || {};
  const remote = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const sb = remote ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const $ = id => document.getElementById(id);
  const storageBucket = cfg.storageBucket || 'ebooks';
  const toast = (message, error = false) => {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.className = `toast show${error ? ' error' : ''}`;
    window.clearTimeout(el._hideTimer);
    el._hideTimer = window.setTimeout(() => { el.className = 'toast'; }, 3500);
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const safeParseJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn('[Bahagia] localStorage parse failed:', key, error);
      return fallback;
    }
  };

  const safeStoreJSON = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('[Bahagia] localStorage save failed:', key, error);
      return false;
    }
  };

  const normalizeEmail = value => String(value ?? '').trim().toLowerCase();
  const normalizeName = value => String(value ?? '').trim().replace(/\s+/g, ' ');

  const acceptedUploadExtensions = new Set(['pdf', 'epub', 'doc', 'docx']);
  const getUploadExtension = name => String(name || '').split('.').pop()?.toLowerCase() || '';
  const validateUploadFiles = files => [...files].filter(file => {
    const extension = getUploadExtension(file.name);
    if (!acceptedUploadExtensions.has(extension)) {
      toast(`${file.name}: format tidak didukung. Gunakan PDF, EPUB, DOC, atau DOCX.`, true);
      return false;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast(`${file.name} melebihi batas 25 MB.`, true);
      return false;
    }
    return true;
  });

  const renderFileQueue = (files = []) => {
    const queue = $('fileQueue');
    if (!queue) return;
    if (!files.length) {
      queue.innerHTML = '';
      return;
    }
    queue.innerHTML = files.map(file => `
      <div class="queue-item">
        <span>${esc(file.name)}</span>
        <small>${(file.size / (1024 * 1024)).toFixed(1)} MB</small>
      </div>
    `).join('');
  };

  const syncBookSearch = () => {
    const query = String($('search')?.value || '').trim().toLocaleLowerCase('id-ID');
    document.querySelectorAll('#bookGrid .book-card').forEach(card => {
      const text = (card.textContent || '').toLocaleLowerCase('id-ID');
      card.classList.toggle('search-hidden', Boolean(query) && !text.includes(query));
    });
  };

  const updateActiveNav = () => {
    const current = location.hash.replace('#', '') || 'dashboard';
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
    const section = document.getElementById(current);
    const heading = section?.querySelector('h1, h2');
    if (heading && $('pageTitle')) $('pageTitle').textContent = heading.textContent.trim();
    $('sidebar')?.classList.remove('open');
  };

  const seedLocalUsers = () => {
    const defaults = {
      'admin@bahagia.com': { id: crypto.randomUUID(), email: 'admin@bahagia.com', password: 'Admin123!', name: 'Admin Bahagia', role: 'admin' },
      'user@bahagia.com': { id: crypto.randomUUID(), email: 'user@bahagia.com', password: 'User123!', name: 'User Bahagia', role: 'user' }
    };
    const saved = safeParseJSON('bahagia_users', {});
    const next = { ...defaults, ...saved };
    if (!Object.prototype.hasOwnProperty.call(saved, 'admin@bahagia.com')) next['admin@bahagia.com'] = defaults['admin@bahagia.com'];
    if (!Object.prototype.hasOwnProperty.call(saved, 'user@bahagia.com')) next['user@bahagia.com'] = defaults['user@bahagia.com'];
    safeStoreJSON('bahagia_users', next);
    return next;
  };

  let authUser = null, profile = null, books = [], blocks = [], publicBooks = [];
  const localUsers = seedLocalUsers();
  const localBooks = () => safeParseJSON('bahagia_books', []);
  const localBlocks = () => safeParseJSON('bahagia_blocks', []);
  const localSave = () => {
    safeStoreJSON('bahagia_books', books);
    safeStoreJSON('bahagia_blocks', blocks);
  };

  const isAdmin = () => profile?.role === 'admin' || authUser?.role === 'admin';

  function showAuth() {
    $('app')?.classList.add('hidden');
    $('authScreen')?.classList.remove('hidden');
  }

  function showAdmin() {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    $('admin')?.classList.remove('hidden');
  }

  function renderUser() {
    const name = profile?.name || authUser?.name || authUser?.email?.split('@')[0] || 'Pengguna';
    if ($('userName')) $('userName').textContent = name;
    if ($('userRole')) $('userRole').textContent = isAdmin() ? 'Administrator' : 'Pengguna';
    if ($('avatar')) $('avatar').textContent = name[0].toUpperCase();
    if (isAdmin()) showAdmin();
    else document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
  }

  function renderBooks() {
    const grid = $('bookGrid');
    if (!grid) return;
    grid.innerHTML = books.length
      ? books.map((book, index) => `<article class="book-card">
          <div class="book-cover">▣</div>
          <div class="book-info">
            <h3>${esc(book.title || book.name || 'Judul ebook')}</h3>
            <small>${esc(book.owner_email || book.email || '')}</small>
            <div class="book-status">${book.is_public ? 'Publik' : 'Pribadi'}</div>
            <div class="book-actions">
              <button class="mini-btn" data-book-action="open" data-book-index="${index}">Buka</button>
              <button class="mini-btn" data-book-action="edit" data-book-index="${index}">Edit Judul</button>
              <button class="mini-btn" data-book-action="toggle" data-book-index="${index}">${book.is_public ? 'Jadikan Pribadi' : 'Jadikan Publik'}</button>
              <button class="mini-btn danger" data-book-action="delete" data-book-index="${index}">Hapus</button>
            </div>
          </div>
        </article>`).join('')
      : '';
    $('emptyBooks')?.classList.toggle('hidden', books.length > 0);
    syncBookSearch();
    grid.querySelectorAll('[data-book-action]').forEach(button => {
      const index = Number(button.dataset.bookIndex);
      const action = button.dataset.bookAction;
      button.onclick = () => {
        const item = books[index];
        if (!item) return;
        if (action === 'open') openBook(item);
        if (action === 'edit') editBook(item);
        if (action === 'toggle') togglePublicBook(item);
        if (action === 'delete') deleteBook(item);
      };
    });
  }

  function renderPublicReader() {
    const list = $('readerList');
    if (!list) return;
    list.innerHTML = publicBooks.length
      ? publicBooks.map(book => `<button class="reader-item" data-book-id="${book.id}"><div class="reader-cover">📚</div><div><strong>${esc(book.title || 'Judul ebook')}</strong><small>${esc(book.owner_email || '')}</small></div></button>`).join('')
      : '<p class="muted">Belum ada ebook publik.</p>';
    list.querySelectorAll('[data-book-id]').forEach(button => {
      button.onclick = async () => {
        const book = publicBooks.find(item => item.id === button.dataset.bookId);
        if (book) await openPublicBook(book);
      };
    });
  }

  function renderStats() {
    if ($('statBooks')) $('statBooks').textContent = books.length;
    if ($('statBlocks')) $('statBlocks').textContent = blocks.length;
    if ($('statReaders')) $('statReaders').textContent = publicBooks.length || 0;
  }

  function setReaderUrl(url) {
    const iframe = $('readerFrame');
    const placeholder = $('readerPlaceholder');
    if (iframe) {
      iframe.src = url || '';
      iframe.classList.toggle('hidden', !url);
    }
    if (placeholder) placeholder.classList.toggle('hidden', Boolean(url));
  }

  const getFileExtension = input => String(input || '').split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || '';
  const normalizeOpenedUrl = (bookOrUrl, mimeType = '') => {
    const raw = String(bookOrUrl || '');
    const lower = raw.toLowerCase();
    const extension = getFileExtension(raw) || getFileExtension(mimeType) || '';
    if (!raw) return '';

    if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'odt', 'rtf'].includes(extension)) {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(raw)}`;
    }

    if (lower.startsWith('http://') || lower.startsWith('https://')) return raw;
    return raw;
  };

  function openBook(book) {
    if (!book) return;
    if (book.url) {
      window.open(book.url, '_blank', 'noopener');
      return;
    }
    if (remote && book.storage_path) {
      openPublicBook({ ...book, id: book.id || book.storage_path });
      return;
    }
    toast(`File ${book.title || book.name} tidak memiliki link preview.`, true);
  }

  async function loadProfile() {
    if (!remote || !authUser?.id) return;
    const { data, error } = await sb.from('profiles').select('id,email,name,role').eq('id', authUser.id).single();
    if (error) throw error;
    profile = data;
  }

  async function loadAdmin() {
    if (!remote || !isAdmin()) return;
    const [{ count: users }, { count: ebookCount }, { data: settings }] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      sb.from('ebooks').select('*', { count: 'exact', head: true }),
      sb.from('site_settings').select('site_name,copyright_email').eq('id', 1).maybeSingle()
    ]);

    if ($('adminUsers')) $('adminUsers').textContent = users || 0;
    if ($('adminBooks')) $('adminBooks').textContent = ebookCount || 0;
    if (settings) {
      if ($('siteName')) $('siteName').value = settings.site_name || '';
      if ($('copyrightEmail')) $('copyrightEmail').value = settings.copyright_email || '';
    }
  }

  async function loadPublicBooks() {
    if (!remote) {
      publicBooks = books.filter(item => item.is_public);
      renderPublicReader();
      return;
    }
    const { data, error } = await sb.from('ebooks').select('*').eq('is_public', true).order('created_at', { ascending: false });
    if (error) throw error;
    publicBooks = data || [];
    renderPublicReader();
  }

  async function loadRemoteData() {
    if (!remote) return;

    const { data: bookData, error: booksError } = await sb
      .from('ebooks')
      .select('*')
      .or(`owner_id.eq.${authUser.id},is_public.eq.true`)
      .order('created_at', { ascending: false });
    if (booksError) throw booksError;
    books = bookData || [];

    const { data: builderData, error: builderError } = await sb
      .from('builder_pages')
      .select('blocks')
      .eq('owner_id', authUser.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!builderError && Array.isArray(builderData?.blocks)) blocks = builderData.blocks;

    await loadPublicBooks();
    await loadAdmin();
  }

  async function enterApp() {
    if (remote) {
      await loadProfile();
      await loadRemoteData();
    } else {
      books = localBooks().map((book, index) => ({ ...book, id: book.id || `local-${index}` }));
      blocks = localBlocks();
      profile = { ...authUser, role: authUser.role || 'user' };
      publicBooks = books.filter(item => item.is_public);
    }

    $('authScreen')?.classList.add('hidden');
    $('app')?.classList.remove('hidden');
    renderUser();
    renderBooks();
    renderStats();
    renderPublicReader();
  }

  async function signIn(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = String(password || '');

    if (remote) {
      const { data, error } = await sb.auth.signInWithPassword({ email: normalizedEmail, password: normalizedPassword });
      if (error) throw error;
      if (data.user && !data.user.email_confirmed_at) {
        await sb.auth.signOut();
        throw new Error('Email belum diverifikasi. Klik "Kirim verifikasi email" untuk mengirim ulang konfirmasi.');
      }
      authUser = { ...data.user, role: data.user.role || 'user' };
    } else {
      const found = localUsers[normalizedEmail];
      if (!found || found.password !== normalizedPassword) throw new Error('Email atau password salah.');
      authUser = { ...found, id: found.id || crypto.randomUUID(), email: found.email, role: found.role || 'user' };
      safeStoreJSON('bahagia_session', authUser);
    }
    await enterApp();
    toast(`Selamat datang ${authUser.name || authUser.email.split('@')[0]}.`);
  }

  async function signUp(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = String(password || '');

    if (remote) {
      const { data, error } = await sb.auth.signUp({
        email: normalizedEmail,
        password: normalizedPassword,
        options: {
          data: { name: normalizedEmail.split('@')[0], role: 'user' },
          emailRedirectTo: `${location.origin}${location.pathname}`
        }
      });
      if (error) throw error;
      if (data?.user && !data.user.email_confirmed_at) {
        toast('Pendaftaran berhasil. Cek email Anda untuk verifikasi lalu masuk.');
      } else {
        toast('Pendaftaran berhasil. Silakan masuk.');
      }
      return;
    }

    if (localUsers[normalizedEmail]) throw new Error('Email sudah terdaftar.');
    const role = Object.keys(localUsers).length === 0 ? 'admin' : 'user';
    localUsers[normalizedEmail] = { id: crypto.randomUUID(), email: normalizedEmail, password: normalizedPassword, name: normalizedEmail.split('@')[0], role };
    safeStoreJSON('bahagia_users', localUsers);
    authUser = { ...localUsers[normalizedEmail], role };
    safeStoreJSON('bahagia_session', authUser);
    await enterApp();
    toast('Akun baru berhasil dibuat.');
  }

  async function sendResetPasswordEmail() {
    if (!remote) {
      toast('Reset password hanya tersedia ketika Supabase sudah aktif.', true);
      return;
    }

    const input = $('email')?.value || window.prompt('Masukkan email akun Anda:');
    if (!input) {
      toast('Email wajib diisi.', true);
      return;
    }

    const email = normalizeEmail(input);
    if (!email) {
      toast('Email wajib diisi.', true);
      return;
    }

    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}` });
    if (error) throw error;
    toast('Link reset password dikirim ke email Anda.');
  }

  async function sendVerificationEmail() {
    if (!remote) {
      toast('Verifikasi email hanya tersedia ketika Supabase sudah aktif.', true);
      return;
    }

    const target = normalizeEmail(authUser?.email || $('email')?.value || '');
    if (!target) {
      toast('Masukkan email atau login terlebih dahulu.', true);
      return;
    }

    const { error } = await sb.auth.resend({ type: 'signup', email: target });
    if (error) throw error;
    toast('Email verifikasi berhasil dikirim ulang.');
  }

  async function openPublicBook(book) {
    if (!book) return;
    if (!remote) {
      toast('Baca publik memerlukan konfigurasi Supabase.', true);
      return;
    }

    try {
      let url = '';
      if (book.storage_path) {
        const { data, error } = await sb.storage.from(storageBucket).createSignedUrl(book.storage_path, 3600);
        if (error) throw error;
        url = data?.signedUrl || '';
      }
      if (!url && book.public_url) url = book.public_url;
      if (!url) {
        toast('Buku ini belum memiliki file yang bisa dibaca.', true);
        return;
      }

      const viewerUrl = normalizeOpenedUrl(url, book.mime_type || getUploadExtension(book.title || book.name || book.storage_path || book.public_url));
      setReaderUrl(viewerUrl || url);
      toast(`Membuka ${book.title || 'ebook'}`);
    } catch (error) {
      toast(error.message || 'Gagal membuka ebook publik.', true);
    }
  }

  async function editBook(book) {
    if (!book) return;
    const nextTitle = window.prompt('Masukkan judul baru ebook:', book.title || book.name);
    if (nextTitle === null) return;
    const title = normalizeName(nextTitle);
    if (!title) {
      toast('Judul tidak boleh kosong.', true);
      return;
    }

    try {
      if (!remote) {
        book.title = title;
        book.name = title;
        localSave();
        renderBooks();
        renderPublicReader();
        toast('Judul ebook diperbarui.');
        return;
      }

      const { error } = await sb.from('ebooks').update({ title }).eq('id', book.id);
      if (error) throw error;
      book.title = title;
      book.name = title;
      publicBooks = publicBooks.map(item => item.id === book.id ? { ...item, title, name: title } : item);
      renderBooks();
      renderPublicReader();
      toast('Judul ebook diperbarui.');
    } catch (error) {
      toast(error.message || 'Gagal mengubah judul ebook.', true);
    }
  }

  async function uploadFiles(files) {
    const validFiles = validateUploadFiles(files || []);
    if (!validFiles.length) {
      renderFileQueue([]);
      return;
    }

    renderFileQueue(validFiles);

    for (const file of validFiles) {
      const safeId = crypto.randomUUID();
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
      const payload = {
        id: safeId,
        name: file.name,
        title: file.name,
        owner_email: authUser?.email || '',
        is_public: false,
        owner_id: authUser?.id || null,
        storage_path: null
      };

      if (!remote) {
        books.unshift(payload);
        localSave();
        continue;
      }

      const path = `${authUser.id}/${safeId}-${safeName}`;
      const upload = await sb.storage.from(storageBucket).upload(path, file, {
        upsert: false,
        contentType: file.type || 'application/octet-stream'
      });
      if (upload.error) throw upload.error;

      const insert = await sb.from('ebooks').insert({
        owner_id: authUser.id,
        title: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        is_public: false
      }).select().single();
      if (insert.error) throw insert.error;

      books.unshift({ ...insert.data, owner_email: authUser.email });
    }

    renderBooks();
    renderStats();
    renderFileQueue([]);
    toast('Upload ebook berhasil.');
  }

  async function togglePublicBook(book) {
    if (!book) return;
    if (!remote) {
      if (!authUser || (book.owner_email !== authUser.email && authUser.role !== 'admin')) return;
      book.is_public = !book.is_public;
      localSave();
      publicBooks = book.is_public ? [...publicBooks.filter(item => item.id !== book.id), book] : publicBooks.filter(item => item.id !== book.id);
      renderBooks();
      renderPublicReader();
      toast(book.is_public ? 'Ebook dibuat publik.' : 'Ebook diubah menjadi pribadi.');
      return;
    }

    try {
      const next = !book.is_public;
      const { error } = await sb.from('ebooks').update({ is_public: next }).eq('id', book.id);
      if (error) throw error;
      book.is_public = next;
      if (next) publicBooks = [book, ...publicBooks.filter(item => item.id !== book.id)];
      else publicBooks = publicBooks.filter(item => item.id !== book.id);
      renderBooks();
      renderPublicReader();
      toast(next ? 'Ebook dibuat publik.' : 'Ebook diubah menjadi pribadi.');
    } catch (error) {
      toast(error.message || 'Gagal mengubah status publik.', true);
    }
  }

  async function deleteBook(book) {
    if (!book) return;
    if (!window.confirm(`Hapus ${book.title || book.name}?`)) return;

    try {
      if (!remote) {
        books = books.filter(item => item.id !== book.id);
        publicBooks = publicBooks.filter(item => item.id !== book.id);
        localSave();
        renderBooks();
        renderPublicReader();
        toast('Ebook dihapus.');
        return;
      }

      if (book.storage_path) {
        await sb.storage.from(storageBucket).remove([book.storage_path]);
      }
      const { error } = await sb.from('ebooks').delete().eq('id', book.id);
      if (error) throw error;
      books = books.filter(item => item.id !== book.id);
      publicBooks = publicBooks.filter(item => item.id !== book.id);
      renderBooks();
      renderPublicReader();
      toast('Ebook dihapus.');
    } catch (error) {
      toast(error.message || 'Gagal menghapus ebook.', true);
    }
  }

  $('emailForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await signIn($('email').value.trim().toLowerCase(), $('password').value);
    } catch (error) {
      toast(error.message || 'Gagal masuk.', true);
    }
  });

  $('signupBtn')?.addEventListener('click', async () => {
    try {
      await signUp($('email').value.trim().toLowerCase(), $('password').value);
    } catch (error) {
      toast(error.message || 'Gagal daftar.', true);
    }
  });

  $('forgotPasswordBtn')?.addEventListener('click', async () => {
    try {
      await sendResetPasswordEmail();
    } catch (error) {
      toast(error.message || 'Gagal mengirim email reset password.', true);
    }
  });

  $('verifyEmailBtn')?.addEventListener('click', async () => {
    try {
      await sendVerificationEmail();
    } catch (error) {
      toast(error.message || 'Gagal mengirim email verifikasi.', true);
    }
  });

  $('demoAdminBtn')?.addEventListener('click', () => {
    $('email').value = 'admin@bahagia.com';
    $('password').value = 'Admin123!';
    $('emailForm').requestSubmit();
  });

  $('demoUserBtn')?.addEventListener('click', () => {
    $('email').value = 'user@bahagia.com';
    $('password').value = 'User123!';
    $('emailForm').requestSubmit();
  });

  $('googleBtn')?.addEventListener('click', async () => {
    if (!remote) {
      toast('Isi config.js untuk mengaktifkan Google.', true);
      return;
    }
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.href.split('#')[0] }
    });
    if (error) toast(error.message, true);
  });

  $('logoutBtn')?.addEventListener('click', async () => {
    try {
      if (remote) await sb.auth.signOut();
    } catch (error) {
      console.warn('[Bahagia] signOut failed:', error);
    }
    localStorage.removeItem('bahagia_session');
    authUser = null;
    profile = null;
    books = [];
    blocks = [];
    publicBooks = [];
    setReaderUrl('');
    renderBooks();
    renderPublicReader();
    renderStats();
    showAuth();
  });

  $('fileInput')?.addEventListener('change', async e => {
    try {
      const selected = validateUploadFiles(e.target.files || []);
      if (!selected.length) {
        e.target.value = '';
        renderFileQueue([]);
        return;
      }
      await uploadFiles(selected);
      e.target.value = '';
      renderFileQueue([]);
    } catch (error) {
      toast(error.message || 'Upload gagal.', true);
      e.target.value = '';
      renderFileQueue([]);
    }
  });

  ['quickUpload', 'heroUpload', 'addBookBtn'].forEach(id => {
    $(id)?.addEventListener('click', () => {
      location.hash = 'upload';
      $('fileInput')?.click();
    });
  });

  document.querySelectorAll('.tool').forEach(button => {
    button.addEventListener('click', () => {
      blocks.push({ id: crypto.randomUUID(), type: button.dataset.block, createdAt: Date.now() });
      if (!remote) localSave();
      renderStats();
      toast('Blok ditambahkan.');
    });
  });

  $('saveBuilder')?.addEventListener('click', async () => {
    try {
      if (remote) {
        const { error } = await sb.from('builder_pages').upsert({
          owner_id: authUser.id,
          title: $('builderTitle')?.value || 'Untitled',
          blocks
        }, { onConflict: 'owner_id' });
        if (error) throw error;
      } else {
        localSave();
      }
      toast('Builder tersimpan.');
    } catch (error) {
      toast(error.message || 'Gagal menyimpan builder.', true);
    }
  });

  $('saveSettings')?.addEventListener('click', async () => {
    try {
      if (!isAdmin()) throw new Error('Akses admin diperlukan.');
      const { error } = await sb.from('site_settings').upsert({
        id: 1,
        site_name: $('siteName')?.value || 'Webook Bahagia',
        copyright_email: $('copyrightEmail')?.value || '',
        updated_by: authUser.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (error) throw error;
      toast('Pengaturan disimpan.');
    } catch (error) {
      toast(error.message || 'Gagal simpan pengaturan.', true);
    }
  });

  $('refreshAdmin')?.addEventListener('click', async () => {
    try {
      await loadAdmin();
      toast('Data admin diperbarui.');
    } catch (error) {
      toast(error.message || 'Gagal memuat admin.', true);
    }
  });

  $('menuBtn')?.addEventListener('click', () => $('sidebar')?.classList.toggle('open'));
  document.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.style.display = 'none'; }));
  $('search')?.addEventListener('input', syncBookSearch);
  window.addEventListener('hashchange', updateActiveNav);
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    if (reason) toast(reason.message || 'Terjadi kesalahan. Silakan coba lagi.', true);
  });

  (async () => {
    try {
      if (remote) {
        const { data } = await sb.auth.getSession();
        if (!data.session) return showAuth();
        authUser = data.session.user;
        await enterApp();
      } else {
        authUser = safeParseJSON('bahagia_session', null);
        if (!authUser) return showAuth();
        await enterApp();
      }
      updateActiveNav();
    } catch (error) {
      showAuth();
      toast(error.message || 'Session gagal dimuat.', true);
    }
  })();
})();
