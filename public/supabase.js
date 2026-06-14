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
    console.log("Supabase URL:", config.supabaseUrl);
    console.log("Supabase anon key exists:", Boolean(config.supabaseAnonKey));
    console.log("Supabase anon key prefix:", config.supabaseAnonKey.slice(0, 8));
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
      const user = data.user || null;
      const session = data.session || null;
      return {
        user,
        session,
        message: user && !session
          ? "Account created. Please check your email to confirm your account."
          : "Account created",
      };
    } catch (error) {
      console.error("Supabase sign up error:", error);
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
      console.error("Supabase sign in error:", error);
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
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        lastError = "";
        return null;
      }

      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      lastError = "";
      return data.user || null;
    } catch (error) {
      if (error.message === "Auth session missing!") {
        lastError = "";
        return null;
      }
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

  async function getUserPreferences() {
    const supabase = await initSupabase();
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("user_preferences")
      .select("watchlist, custom_alerts, language, push_enabled, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function saveUserPreferences(preferences) {
    const supabase = await initSupabase();
    const user = await getCurrentUser();
    if (!user) throw new Error("Auth session missing!");

    const { data, error } = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          watchlist: preferences.watchlist || [],
          custom_alerts: preferences.customAlerts || [],
          language: preferences.language || "en",
          push_enabled: Boolean(preferences.pushEnabled),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("watchlist, custom_alerts, language, push_enabled, updated_at")
      .single();
    if (error) throw error;
    return data;
  }

  window.MacroRadarAuth = {
    initSupabase,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    onAuthStateChange,
    getUserPreferences,
    saveUserPreferences,
    getLastError: () => lastError,
  };
})();
