/**
 * DyskiHub.pl — Supabase Auth
 */
(function () {
  const SESSION_KEY = 'dyskihub_auth_session';
  let supabaseClient = null;
  let profileCache = null;

  function getStoredSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSession(session) {
    if (!session?.access_token) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    const expiresAt = session.expires_at
      ? (session.expires_at > 1e12 ? session.expires_at : session.expires_at * 1000)
      : Date.now() + (session.expires_in || 3600) * 1000;
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: expiresAt,
      })
    );
  }

  function sessionFromSupabase(supabaseSession) {
    if (!supabaseSession) return null;
    return {
      access_token: supabaseSession.access_token,
      refresh_token: supabaseSession.refresh_token,
      expires_in: supabaseSession.expires_in,
      expires_at: supabaseSession.expires_at,
    };
  }

  function isSessionExpiringSoon(stored) {
    if (!stored?.access_token) return true;
    if (!stored.expires_at) return true;
    return Date.now() >= stored.expires_at - 60_000;
  }

  async function refreshSession(force = false) {
    const stored = getStoredSession();
    if (!stored?.refresh_token) return null;

    if (!force && !isSessionExpiringSoon(stored)) {
      return stored.access_token;
    }

    if (!supabaseClient) {
      try {
        const config = await fetchConfig();
        supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      } catch {
        return null;
      }
    }

    const { data, error } = await supabaseClient.auth.refreshSession({
      refresh_token: stored.refresh_token,
    });

    if (error || !data.session) {
      localStorage.removeItem(SESSION_KEY);
      profileCache = null;
      return null;
    }

    saveSession(sessionFromSupabase(data.session));
    return data.session.access_token;
  }

  async function ensureAccessToken() {
    const stored = getStoredSession();
    if (!stored?.access_token) return null;

    if (!isSessionExpiringSoon(stored)) {
      return stored.access_token;
    }

    return refreshSession(true);
  }

  async function fetchConfig() {
    const res = await fetch('/.netlify/functions/supabase-config');
    if (!res.ok) throw new Error('Supabase nie jest skonfigurowany na serwerze');
    return res.json();
  }

  async function initAuth() {
    if (!window.supabase?.createClient) {
      console.warn('Supabase SDK nie załadowany');
      return false;
    }

    const config = await fetchConfig();
    supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const stored = getStoredSession();
    if (stored?.access_token) {
      const { data, error } = await supabaseClient.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
      });
      if (!error && data.session) {
        saveSession(sessionFromSupabase(data.session));
        await loadProfile();
        return true;
      }
      const refreshed = await refreshSession(true);
      if (refreshed) {
        await loadProfile();
        return true;
      }
      localStorage.removeItem(SESSION_KEY);
    }

    profileCache = null;
    return true;
  }

  function getSupabase() {
    return supabaseClient;
  }

  function getAccessToken() {
    return getStoredSession()?.access_token || null;
  }

  async function getAccessTokenFresh() {
    return ensureAccessToken();
  }

  function getCurrentUser() {
    if (!profileCache) return null;
    return {
      id: profileCache.id,
      username: profileCache.username,
      email: profileCache.email,
      tokens: profileCache.tokens,
      is_premium: profileCache.is_premium,
      is_admin: profileCache.is_admin,
    };
  }

  const ADMIN_EMAILS = [
    'marcelkuczynski47@gmail.com',
    'braszkamc@gmail.com',
  ];

  function isAdminSession() {
    const user = getCurrentUser();
    if (!user) return false;
    if (user.is_admin) return true;
    const email = (user.email || '').toLowerCase();
    return ADMIN_EMAILS.includes(email);
  }

  async function loadProfile() {
    if (!supabaseClient) return null;

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      profileCache = null;
      return null;
    }

    let { data, error } = await supabaseClient
      .from('profiles')
      .select('id, username, email, tokens, is_admin, is_premium, banned, created_at, referred_by')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (error && /is_premium/i.test(error.message || '')) {
      ({ data, error } = await supabaseClient
        .from('profiles')
        .select('id, username, email, tokens, is_admin, banned, created_at, referred_by')
        .eq('id', userData.user.id)
        .maybeSingle());
      if (data) data.is_premium = false;
    }

    if (error || !data) {
      profileCache = null;
      return null;
    }

    if (data.banned) {
      await signOut();
      throw new Error('Konto zostało zablokowane');
    }

    profileCache = data;

    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (sessionData?.session) {
      saveSession(sessionFromSupabase(sessionData.session));
    }

    if (typeof updateTokenUI === 'function') {
      updateTokenUI(data.tokens);
    }
    return data;
  }

  async function signUp({ username, email, password, referredBy }) {
    if (!supabaseClient) throw new Error('Auth niedostępny');

    const { data: available, error: checkErr } = await supabaseClient.rpc('check_username_available', {
      p_username: username,
    });
    if (checkErr) throw new Error('Nie udało się sprawdzić loginu');
    if (!available) throw new Error('Ten login jest już zajęty — wybierz inną nazwę.');

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          referred_by: referredBy || null,
        },
      },
    });

    if (error) {
      if (/already registered/i.test(error.message)) {
        throw new Error('Ten e-mail jest już zarejestrowany.');
      }
      if (/password/i.test(error.message) && /(short|least|characters|length)/i.test(error.message)) {
        throw new Error('Hasło jest za krótkie — użyj dłuższego hasła.');
      }
      throw new Error(error.message);
    }

    if (data.session) {
      saveSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      });
      await loadProfile();
    }

    return data;
  }

  async function signIn({ identifier, password }) {
    const res = await fetch('/.netlify/functions/auth-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Logowanie nie powiodło się');

    saveSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    });

    if (supabaseClient) {
      await supabaseClient.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
    }

    await loadProfile();
    return data;
  }

  async function signOut() {
    profileCache = null;
    localStorage.removeItem(SESSION_KEY);
    if (supabaseClient) await supabaseClient.auth.signOut();
    if (typeof updateTokenUI === 'function') updateTokenUI(0);
    if (typeof updatePremiumUI === 'function') updatePremiumUI();
  }

  async function spendTokens(amount) {
    if (!supabaseClient || !profileCache) return 0;
    const { data, error } = await supabaseClient.rpc('spend_tokens', { p_amount: amount });
    if (error) {
      if (error.message?.includes('insufficient')) {
        throw new Error('Za mało żetonów');
      }
      throw new Error(error.message);
    }
    profileCache.tokens = data;
    if (typeof updateTokenUI === 'function') updateTokenUI(data);
    return data;
  }

  function getTokenBalanceSync() {
    return profileCache?.tokens ?? 0;
  }

  function isPremiumUser() {
    return Boolean(profileCache?.is_premium);
  }

  function applyTokensFromServer(newTokens) {
    if (profileCache && typeof newTokens === 'number') {
      profileCache.tokens = newTokens;
    }
  }

  async function updateEmail(email) {
    if (!supabaseClient || !profileCache) throw new Error('Nie jesteś zalogowany');
    const { error: authError } = await supabaseClient.auth.updateUser({ email });
    if (authError) throw new Error(authError.message);

    const { data, error } = await supabaseClient
      .from('profiles')
      .update({ email })
      .eq('id', profileCache.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    profileCache = data;
    return data;
  }

  async function updatePassword(newPassword) {
    if (!supabaseClient) throw new Error('Nie jesteś zalogowany');
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  }

  async function updateUsername(username) {
    if (!supabaseClient || !profileCache) throw new Error('Nie jesteś zalogowany');

    const { data: available } = await supabaseClient.rpc('check_username_available', {
      p_username: username,
    });
    if (!available && username.toLowerCase() !== profileCache.username.toLowerCase()) {
      throw new Error('Ten login jest już zajęty.');
    }

    const { data, error } = await supabaseClient
      .from('profiles')
      .update({ username })
      .eq('id', profileCache.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    profileCache = data;
    return data;
  }

  async function purchasePack(packId) {
    const token = await ensureAccessToken();
    if (!token) throw new Error('Zaloguj się, aby kupić żetony');

    const res = await fetch('/.netlify/functions/token-purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ packId }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Zakup nie powiódł się');

    const previousTokens = profileCache?.tokens ?? 0;
    if (profileCache) profileCache.tokens = data.newTokens;
    if (typeof animateTokenBalance === 'function' && data.newTokens > previousTokens) {
      animateTokenBalance(previousTokens, data.newTokens);
    } else if (typeof updateTokenUI === 'function') {
      updateTokenUI(data.newTokens);
    }
    return data;
  }

  async function purchasePremium() {
    const token = await ensureAccessToken();
    if (!token) throw new Error('Zaloguj się, aby kupić Premium');

    const res = await fetch('/.netlify/functions/premium-purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: '{}',
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Zakup Premium nie powiódł się');

    if (profileCache) profileCache.is_premium = true;
    if (typeof updatePremiumUI === 'function') updatePremiumUI();
    return data;
  }

  async function adminFetch(path, options = {}) {
    const token = await ensureAccessToken();
    if (!token) throw new Error('Brak sesji');

    const res = await fetch(`/.netlify/functions/${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Błąd API');
    return data;
  }

  window.DyskiAuth = {
    initAuth,
    getSupabase,
    getAccessToken,
    getAccessTokenFresh,
    ensureAccessToken,
    refreshSession,
    getCurrentUser,
    isAdminSession,
    loadProfile,
    signUp,
    signIn,
    signOut,
    spendTokens,
    purchasePack,
    purchasePremium,
    getTokenBalanceSync,
    isPremiumUser,
    applyTokensFromServer,
    updateUsername,
    updateEmail,
    updatePassword,
    adminFetch,
  };

  window.getCurrentUser = getCurrentUser;
})();
