const {
  corsHeaders,
  jsonResponse,
  getSupabaseUrl,
} = require('./_lib/admin-auth');

const UNLOCK_COST = 20;

async function verifyUserToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: jsonResponse(401, { error: 'Zaloguj się, aby odblokować zdjęcie' }) };
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
  if (!Number.isFinite(profileId) || profileId < 1) return null;
  return Math.floor(profileId);
}

function parsePhotoKey(value) {
  const key = String(value || '').trim();
  if (!/^[a-zA-Z0-9_.-]{1,120}$/.test(key)) return null;
  return key;
}

async function fetchUnlockedKeys(auth, profileId) {
  const query = new URLSearchParams({
    select: 'photo_key',
    profile_id: `eq.${profileId}`,
    user_id: `eq.${auth.userId}`,
    order: 'created_at.asc',
  });

  const res = await fetch(`${auth.supabaseUrl}/rest/v1/profile_photo_unlocks?${query.toString()}`, {
    headers: {
      apikey: auth.anonKey,
      Authorization: `Bearer ${auth.token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`unlocks_fetch_failed:${err}`);
  }

  const rows = await res.json();
  return rows.map((row) => row.photo_key).filter(Boolean);
}

async function fetchIsSuperFan(auth, profileId) {
  const query = new URLSearchParams({
    select: 'id',
    user_id: `eq.${auth.userId}`,
    profile_id: `eq.${profileId}`,
    limit: '1',
  });

  const res = await fetch(`${auth.supabaseUrl}/rest/v1/profile_superfan_subscriptions?${query.toString()}`, {
    headers: {
      apikey: auth.anonKey,
      Authorization: `Bearer ${auth.token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) return false;
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
      if (!profileId) return jsonResponse(400, { error: 'Nieprawidłowy profil' });

      const unlockedKeys = await fetchUnlockedKeys(auth, profileId);
      const isSuperFan = await fetchIsSuperFan(auth, profileId);
      return jsonResponse(200, { profileId, unlockCost: UNLOCK_COST, unlockedKeys, isSuperFan });
    }

    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Nieprawidłowe dane żądania' });
    }

    const profileId = parseProfileId(body.profileId);
    const photoKey = parsePhotoKey(body.photoKey);
    if (!profileId || !photoKey) {
      return jsonResponse(400, { error: 'Nieprawidłowe dane zdjęcia' });
    }

    const rpcRes = await fetch(`${auth.supabaseUrl}/rest/v1/rpc/unlock_profile_photo`, {
      method: 'POST',
      headers: {
        apikey: auth.anonKey,
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_profile_id: profileId,
        p_photo_key: photoKey,
        p_cost: UNLOCK_COST,
      }),
    });

    const rpcData = await rpcRes.json().catch(() => ({}));
    if (!rpcRes.ok) {
      const msg = String(rpcData?.message || rpcData?.error || '');
      if (msg.includes('insufficient_tokens')) {
        return jsonResponse(400, { error: 'Za mało żetonów, aby odblokować zdjęcie' });
      }
      if (msg.includes('not_authenticated')) {
        return jsonResponse(401, { error: 'Zaloguj się, aby odblokować zdjęcie' });
      }
      if (msg.includes('invalid_')) {
        return jsonResponse(400, { error: 'Nieprawidłowe dane odblokowania' });
      }
      return jsonResponse(500, { error: 'Nie udało się odblokować zdjęcia' });
    }

    const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const unlockedKeys = await fetchUnlockedKeys(auth, profileId);

    return jsonResponse(200, {
      profileId,
      photoKey,
      unlockCost: UNLOCK_COST,
      alreadyUnlocked: Boolean(rpcRow?.already_unlocked),
      newTokens: Number(rpcRow?.new_tokens ?? 0),
      unlockedKeys,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: 'Błąd serwera odblokowania zdjęć' });
  }
};
