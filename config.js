/* Supabase browser configuration. Never put a service_role key here. */
window.BAHAGIA_CONFIG = {
  // Supabase Project Settings → API → Project URL
  supabaseUrl: '',
  // Supabase Project Settings → API → publishable/anon key
  supabaseAnonKey: '',
  storageBucket: 'ebooks',
  // Use the deployed site URL in production. Leave empty to use the current page.
  authRedirectUrl: ''
};

// Load the role-management module without requiring changes to the HTML shell.
const roleScript = document.createElement('script');
roleScript.src = 'admin-roles.js';
roleScript.defer = true;
document.head.appendChild(roleScript);
