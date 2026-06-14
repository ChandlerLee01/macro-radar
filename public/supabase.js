(function () {
  const SUPABASE_MODULE_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
  let client = null;
  let initPromise = null;
  let lastError = "";

  async function loadConfig() {
    const response = await fetch("/api/supabase-config", { cache: "no-store" });
    const config = await response.json();
    if (!response.ok) {
      throw new Error(config.error || "Supabase configuration unavailable");
    }
    if (!config.configured || !config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error("Supabase is not configured");
    }
    return config;
  }

  async function initSupabase() {
    if (client) return client;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        const config = await loadConfig();
        const supabaseModule = await import(SUPABASE_MODULE_URL);
        client = supabaseModule.createClient(config.supabaseUrl, config.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
        lastError = "";
        return client;
      } catch (error) {
        lastError = error.message || "Authentication unavailable";
        client = null;
        throw error;
      } finally {
        initPromise = null;
      }
    })();

    return initPromise;
  }

  async function signUp(email, password) {
    try {
      const supabase = await initSupabase();
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return { user: data.user || null, session: data.session || null };
    } catch (error) {
      lastError = error.message || "Authentication failed";
      throw error;
    }
  }

  async function signIn(email, password) {
    try {
      const supabase = await initSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { user: data.user || null, session: data.session || null };
    } catch (error) {
      lastError = error.message || "Authentication failed";
      throw error;
    }
  }

  async function signOut() {
    try {
      const supabase = await initSupabase();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return true;
    } catch (error) {
      lastError = error.message || "Authentication failed";
      throw error;
    }
  }

  async function getCurrentUser() {
    try {
      const supabase = await initSupabase();
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user || null;
    } catch (error) {
      lastError = error.message || "Authentication unavailable";
      return null;
    }
  }

  async function onAuthStateChange(callback) {
    try {
      const supabase = await initSupabase();
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(session?.user || null);
      });
      return data?.subscription || null;
    } catch {
      return null;
    }
  }

  window.MacroRadarAuth = {
    initSupabase,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    onAuthStateChange,
    getLastError: () => lastError,
  };
})();
