/* Guard the dedicated admin page before exposing its controls. */
(() => {
  const cfg = window.BAHAGIA_CONFIG || {};
  const remote = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const redirectToHome = () => {
    window.location.replace('index.html');
  };

  const verifyAdmin = async () => {
    try {
      if (remote) {
        const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        const { data: sessionData } = await client.auth.getSession();
        if (!sessionData.session) return redirectToHome();
        const { data: profile, error } = await client
          .from('profiles')
          .select('role')
          .eq('id', sessionData.session.user.id)
          .single();
        if (error || profile?.role !== 'admin') return redirectToHome();
        return;
      }

      const session = JSON.parse(localStorage.getItem('bahagia_session') || 'null');
      if (!session || session.role !== 'admin') return redirectToHome();
    } catch (error) {
      redirectToHome();
    }
  };

  verifyAdmin();
})();
