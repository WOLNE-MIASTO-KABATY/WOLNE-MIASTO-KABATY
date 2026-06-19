const { corsHeaders, jsonResponse, getSupabaseUrl, getServiceHeaders } = require('./_lib/admin-auth');

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,32}$/;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = getSupabaseUrl();
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return jsonResponse(503, { error: 'Supabase nie jest skonfigurowany na serwerze' });
  }

  try {
    const { username, email, password, referredBy } = JSON.parse(event.body || '{}');
    const trimmedUsername = String(username || '').trim();
    const trimmedEmail = String(email || '').trim().toLowerCase();

    if (!USERNAME_REGEX.test(trimmedUsername)) {
      return jsonResponse(400, {
        error: 'Nazwa użytkownika: 3–32 znaki (litery, cyfry, kropka, myślnik, podkreślnik).',
      });
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return jsonResponse(400, { error: 'Podaj prawidłowy adres e-mail.' });
    }

    if (!password || String(password).length < 6) {
      return jsonResponse(400, { error: 'Hasło musi mieć co najmniej 6 znaków.' });
    }

    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/check_username_available`, {
      method: 'POST',
      headers: { ...getServiceHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_username: trimmedUsername }),
    });

    if (!rpcRes.ok) {
      const errText = await rpcRes.text();
      console.error('username check failed', errText);
      return jsonResponse(500, { error: 'Nie udało się sprawdzić loginu' });
    }

    const available = await rpcRes.json();
    if (!available) {
      return jsonResponse(409, { error: 'Ten login jest już zajęty — wybierz inną nazwę.' });
    }

    const signupRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: trimmedEmail,
        password,
        data: {
          username: trimmedUsername,
          referred_by: referredBy ? String(referredBy).trim() : null,
        },
      }),
    });

    const signupData = await signupRes.json();
    if (!signupRes.ok) {
      const msg = signupData?.msg || signupData?.error_description || signupData?.message || '';
      if (/already registered|already exists|duplicate/i.test(msg)) {
        return jsonResponse(409, { error: 'Ten e-mail jest już zarejestrowany.' });
      }
      if (/password/i.test(msg) && /(short|least|characters|length)/i.test(msg)) {
        return jsonResponse(400, { error: 'Hasło jest za krótkie — użyj dłuższego hasła.' });
      }
      return jsonResponse(400, { error: msg || 'Nie udało się utworzyć konta' });
    }

    const session = signupData.session || null;

    return jsonResponse(200, {
      user: signupData.user || null,
      access_token: session?.access_token || null,
      refresh_token: session?.refresh_token || null,
      expires_in: session?.expires_in || null,
      needsEmailConfirmation: !session,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: err.message || 'Server error' });
  }
};
