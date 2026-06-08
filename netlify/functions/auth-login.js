const { corsHeaders, jsonResponse, getSupabaseUrl, getServiceHeaders } = require('./_lib/admin-auth');

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
    return jsonResponse(503, { error: 'Supabase nie jest skonfigurowany' });
  }

  try {
    const { identifier, password } = JSON.parse(event.body || '{}');
    if (!identifier?.trim() || !password) {
      return jsonResponse(400, { error: 'Wpisz login lub e-mail oraz hasło' });
    }

    let email = identifier.trim().toLowerCase();

    if (!email.includes('@')) {
      const lookup = await fetch(
        `${supabaseUrl}/rest/v1/profiles?username=ilike.${encodeURIComponent(identifier.trim())}&select=email&limit=1`,
        { headers: { ...getServiceHeaders(), Accept: 'application/json' } }
      );
      if (!lookup.ok) {
        return jsonResponse(500, { error: 'Błąd wyszukiwania konta' });
      }
      const rows = await lookup.json();
      if (!rows.length) {
        return jsonResponse(401, { error: 'Nieprawidłowy login lub hasło' });
      }
      email = rows[0].email.toLowerCase();
    }

    const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const authData = await authRes.json();
    if (!authRes.ok) {
      return jsonResponse(401, { error: 'Nieprawidłowy login lub hasło' });
    }

    if (authData.user?.id) {
      const profileRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${authData.user.id}&select=banned&limit=1`,
        { headers: { ...getServiceHeaders(), Accept: 'application/json' } }
      );
      if (profileRes.ok) {
        const profiles = await profileRes.json();
        if (profiles[0]?.banned) {
          return jsonResponse(403, { error: 'Konto zostało zablokowane' });
        }
      }
    }

    return jsonResponse(200, {
      access_token: authData.access_token,
      refresh_token: authData.refresh_token,
      expires_in: authData.expires_in,
      user: authData.user,
    });
  } catch (err) {
    return jsonResponse(500, { error: err.message || 'Server error' });
  }
};
