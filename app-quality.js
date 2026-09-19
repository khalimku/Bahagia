/* Progressive enhancements for Webook Bahagia. Kept separate so the core app remains easy to audit. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const config = window.BAHAGIA_CONFIG || {};
  const fileInput = $('fileInput');
  const dropzone = document.querySelector('.dropzone');
  const search = $('search');
  const toast = (message, error = false) => {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.className = `toast show${error ? ' error' : ''}`;
    window.clearTimeout(el._hideTimer);
    el._hideTimer = window.setTimeout(() => { el.className = 'toast'; }, 3500);
  };

  const acceptedExtensions = new Set(['pdf', 'epub', 'doc', 'docx']);
  const extensionOf = name => String(name || '').toLowerCase().split('.').pop();
  const validFiles = files => [...files].filter(file => {
    const extension = extensionOf(file.name);
    if (!acceptedExtensions.has(extension)) {
      toast(`${file.name}: format tidak didukung. Gunakan PDF, EPUB, DOC, atau DOCX.`, true);
      return false;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast(`${file.name} melebihi batas 25 MB.`, true);
      return false;
    }
    return true;
  });

  // The native file input is the single upload source of truth. Validate both
  // click and drag/drop paths before handing files to app.js.
  if (fileInput) {
    fileInput.addEventListener('change', event => {
      const files = validFiles(event.target.files);
      if (files.length !== event.target.files.length) {
        const transfer = new DataTransfer();
        files.forEach(file => transfer.items.add(file));
        event.target.files = transfer.files;
      }
    }, { capture: true });
  }

  if (dropzone && fileInput) {
    ['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      dropzone.classList.add('drag-active');
    }));
    ['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      dropzone.classList.remove('drag-active');
    }));
    dropzone.addEventListener('drop', event => {
      const files = validFiles(event.dataTransfer?.files || []);
      if (!files.length) return;
      const transfer = new DataTransfer();
      files.forEach(file => transfer.items.add(file));
      fileInput.files = transfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  // Client-side filtering makes the library usable with larger collections
  // without changing the database query or exposing private records.
  const filterBooks = () => {
    const query = String(search?.value || '').trim().toLocaleLowerCase('id-ID');
    document.querySelectorAll('#bookGrid .book-card').forEach(card => {
      card.classList.toggle('search-hidden', Boolean(query) && !card.textContent.toLocaleLowerCase('id-ID').includes(query));
    });
  };
  search?.addEventListener('input', filterBooks);
  new MutationObserver(filterBooks).observe($('bookGrid') || document.body, { childList: true });

  const updateNavigation = () => {
    const current = location.hash.replace('#', '') || 'dashboard';
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
    const section = document.getElementById(current);
    const heading = section?.querySelector('h1, h2');
    if (heading && $('pageTitle')) $('pageTitle').textContent = heading.textContent.trim();
    $('sidebar')?.classList.remove('open');
  };
  window.addEventListener('hashchange', updateNavigation);
  updateNavigation();

  const readerFrame = $('readerFrame');
  if (readerFrame) {
    readerFrame.setAttribute('referrerpolicy', 'no-referrer');
    readerFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
  }

  // Make async failures visible instead of silently leaving the UI in a
  // partially updated state. Do not reveal internal credentials or URLs.
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    if (reason) toast(reason.message || 'Terjadi kesalahan. Silakan coba lagi.', true);
  });
  window.addEventListener('error', event => {
    if (event.error) console.error('[Webook Bahagia]', event.error);
  });

  // Configuration is intentionally read-only here; never log the anon key.
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    document.querySelectorAll('[data-remote-only]').forEach(el => { el.hidden = true; });
  }
})();
