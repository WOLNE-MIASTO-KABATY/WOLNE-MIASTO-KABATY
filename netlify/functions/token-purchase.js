const {
  corsHeaders,
  jsonResponse,
  getSupabaseUrl,
  getServiceHeaders,
} = require('./_lib/admin-auth');

const PACKS = {
  'pack-20': 20,
  'pack-50': 50,
  'pack-120': 140,
  'pack-300': 310,
  'pack-600': 625,
  'pack-1200': 1150,
};

async function verifyUserToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: jsonResponse(401, { error: 'Zaloguj się, aby kupić żetony' }) };
  }

  const token = authHeader.slice(7);
  const supabaseUrl = getSupabaseUrl();
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return { error: jsonResponse(503, { error: 'Supabase nie jest skonfigurowany' }) };
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  });

  if (!res.ok) {
    return { error: jsonResponse(401, { error: 'Sesja wygasła — zaloguj się ponownie' }) };
  }

  const user = await res.json();
  if (!user?.id) {
    return { error: jsonResponse(401, { error: 'Nieprawidłowa sesja' }) };
  }

  return { userId: user.id };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const auth = await verifyUserToken(event);
  if (auth.error) return auth.error;

  try {
    const { packId } = JSON.parse(event.body || '{}');
    const tokens = PACKS[packId];

    if (!tokens) {
      return jsonResponse(400, { error: 'Nieprawidłowy pakiet żetonów' });
    }

    const supabaseUrl = getSupabaseUrl();
    const headers = getServiceHeaders();

    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${auth.userId}&select=id,tokens&limit=1`,
      { headers: { ...headers, Accept: 'application/json' } }
    );

    if (!profileRes.ok) {
      return jsonResponse(500, { error: 'Nie udało się odczytać profilu' });
    }

    const profiles = await profileRes.json();
    if (!profiles.length) {
      return jsonResponse(404, { error: 'Nie znaleziono profilu' });
    }

    const profile = profiles[0];
    const newTokens = (profile.tokens || 0) + tokens;

    const updateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${auth.userId}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ tokens: newTokens }),
    });

    if (!updateRes.ok) {
      const text = await updateRes.text();
      return jsonResponse(500, { error: text.slice(0, 300) });
    }

    const updated = (await updateRes.json())[0];

    return jsonResponse(200, {
      packId,
      added: tokens,
      newTokens: updated.tokens,
    });
  } catch (err) {
    return jsonResponse(500, { error: err.message || 'Server error' });
  }
};
