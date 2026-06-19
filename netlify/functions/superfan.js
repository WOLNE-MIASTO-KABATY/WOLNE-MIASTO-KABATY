const {
  corsHeaders,
  jsonResponse,
  getSupabaseUrl,
  getServiceHeaders,
} = require('./_lib/admin-auth');

const SUPERFAN_PRICE = '59,99 zł';

async function verifyUserToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: jsonResponse(401, { error: 'Zaloguj się, aby kupić SuperFan' }) };
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

  return { userId: user.id, token, anonKey, supabaseUrl };
}

function parseProfileId(value) {
  const profileId = Number(value);
  if (!Number.isFinite(profileId) || profileId < 1 || profileId > 999) return null;
  return Math.floor(profileId);
}

async function fetchSuperfanProfileIds(auth) {
  const query = new URLSearchParams({
    select: 'profile_id',
    user_id: `eq.${auth.userId}`,
    order: 'created_at.asc',
  });

  const res = await fetch(`${auth.supabaseUrl}/rest/v1/profile_superfan_subscriptions?${query.toString()}`, {
    headers: {
      apikey: auth.anonKey,
      Authorization: `Bearer ${auth.token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.text();
    if (/profile_superfan/i.test(err)) {
      return { missingTable: true, profileIds: [] };
    }
    throw new Error(`superfan_fetch_failed:${err}`);
  }

  const rows = await res.json();
  return {
    missingTable: false,
    profileIds: rows.map((row) => Number(row.profile_id)).filter((id) => Number.isFinite(id)),
  };
}

async function hasSuperfan(auth, profileId) {
  const headers = { ...getServiceHeaders(), Accept: 'application/json' };
  const res = await fetch(
    `${auth.supabaseUrl}/rest/v1/profile_superfan_subscriptions?user_id=eq.${auth.userId}&profile_id=eq.${profileId}&select=id&limit=1`,
    { headers }
  );

  if (!res.ok) {
    if (/profile_superfan/i.test(await res.text())) return false;
    throw new Error('superfan_check_failed');
  }

  const rows = await res.json();
  return rows.length > 0;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const auth = await verifyUserToken(event);
  if (auth.error) return auth.error;

  try {
    if (event.httpMethod === 'GET') {
      const profileId = parseProfileId(event.queryStringParameters?.profileId);
      const data = await fetchSuperfanProfileIds(auth);

      if (data.missingTable) {
        return jsonResponse(503, {
          error: 'SuperFan wymaga migracji bazy — uruchom migration-profile-superfan.sql w Supabase',
          profileIds: [],
          isSuperFan: false,
        });
      }

      const payload = {
        profileIds: data.profileIds,
        price: SUPERFAN_PRICE,
      };

      if (profileId) {
        payload.profileId = profileId;
        payload.isSuperFan = data.profileIds.includes(profileId);
      }

      return jsonResponse(200, payload);
    }

    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Nieprawidłowe dane żądania' });
    }

    const profileId = parseProfileId(body.profileId);
    if (!profileId) {
      return jsonResponse(400, { error: 'Nieprawidłowy profil koleżanki' });
    }

    if (await hasSuperfan(auth, profileId)) {
      return jsonResponse(400, { error: 'Masz już aktywny SuperFan u tej koleżanki' });
    }

    const supabaseUrl = auth.supabaseUrl;
    const headers = getServiceHeaders();

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/profile_superfan_subscriptions`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: auth.userId,
        profile_id: profileId,
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('superfan insert failed', errText);
      if (/profile_superfan/i.test(errText)) {
        return jsonResponse(503, {
          error: 'SuperFan wymaga migracji bazy — uruchom migration-profile-superfan.sql w Supabase',
        });
      }
      return jsonResponse(500, { error: 'Nie udało się aktywować SuperFan' });
    }

    const data = await fetchSuperfanProfileIds(auth);

    return jsonResponse(200, {
      profileId,
      isSuperFan: true,
      profileIds: data.profileIds,
      price: SUPERFAN_PRICE,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: err.message || 'Server error' });
  }
};
