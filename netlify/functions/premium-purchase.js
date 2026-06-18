const {
  corsHeaders,
  jsonResponse,
  getSupabaseUrl,
  getServiceHeaders,
} = require('./_lib/admin-auth');

const PREMIUM_PRICE = '79,99 zł';

async function verifyUserToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: jsonResponse(401, { error: 'Zaloguj się, aby kupić Premium' }) };
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

async function fetchProfile(userId) {
  const supabaseUrl = getSupabaseUrl();
  const headers = { ...getServiceHeaders(), Accept: 'application/json' };

  let res = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=id,is_premium&limit=1`,
    { headers }
  );

  if (!res.ok) {
    res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=id&limit=1`,
      { headers }
    );
  }

  if (!res.ok) throw new Error('profile_fetch_failed');
  const rows = await res.json();
  const profile = rows[0] || null;
  if (profile && profile.is_premium === undefined) {
    profile.is_premium = false;
  }
  return profile;
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
    const profile = await fetchProfile(auth.userId);
    if (!profile) {
      return jsonResponse(404, { error: 'Nie znaleziono profilu' });
    }

    if (profile.is_premium) {
      return jsonResponse(400, { error: 'Masz już aktywne Premium' });
    }

    const supabaseUrl = getSupabaseUrl();
    const headers = getServiceHeaders();

    const patchRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${auth.userId}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ is_premium: true }),
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error('premium-purchase patch failed', errText);
      if (/is_premium/i.test(errText)) {
        return jsonResponse(503, {
          error: 'Premium wymaga aktualizacji bazy — uruchom migrację is_premium w Supabase',
        });
      }
      return jsonResponse(500, { error: 'Nie udało się aktywować Premium' });
    }

    const updated = (await patchRes.json())[0];

    return jsonResponse(200, {
      isPremium: true,
      price: PREMIUM_PRICE,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: err.message || 'Server error' });
  }
};
