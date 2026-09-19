/* Supabase browser configuration. Never put a service_role key here. */
window.BAHAGIA_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  storageBucket: 'ebooks'
};

// Load the role-management module without requiring changes to the HTML shell.
const roleScript = document.createElement('script');
roleScript.src = 'admin-roles.js';
roleScript.defer = true;
document.head.appendChild(roleScript);
