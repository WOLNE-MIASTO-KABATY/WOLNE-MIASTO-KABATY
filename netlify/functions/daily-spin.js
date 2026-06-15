const {
  corsHeaders,
  jsonResponse,
  getSupabaseUrl,
  getServiceHeaders,
} = require('./_lib/admin-auth');

const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Kolejność segmentów na kole (index 0–4) — musi być spójna z spin.js */
const PRIZE_SEGMENTS = [
  { tokens: 0, weight: 65, label: 'Nic' },
  { tokens: 5, weight: 25, label: '5 żetonów' },
  { tokens: 35, weight: 5, label: '35 żetonów' },
  { tokens: 100, weight: 3, label: '100 żetonów' },
  { tokens: 200, weight: 2, label: '200 żetonów' },
];

async function verifyUserToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: jsonResponse(401, { error: 'Zaloguj się, aby kręcić kołem' }) };
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

function rollPrize() {
  const total = PRIZE_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < PRIZE_SEGMENTS.length; i += 1) {
    r -= PRIZE_SEGMENTS[i].weight;
    if (r <= 0) {
      return { segmentIndex: i, prizeTokens: PRIZE_SEGMENTS[i].tokens };
    }
  }
  return { segmentIndex: 0, prizeTokens: 0 };
}

function computeSpinStatus(lastSpinAt) {
  if (!lastSpinAt) {
    return { canSpin: true, nextSpinAt: null, secondsRemaining: 0 };
  }

  const last = new Date(lastSpinAt).getTime();
  const next = last + SPIN_COOLDOWN_MS;
  const now = Date.now();

  if (now >= next) {
    return { canSpin: true, nextSpinAt: null, secondsRemaining: 0 };
  }

  return {
    canSpin: false,
    nextSpinAt: new Date(next).toISOString(),
    secondsRemaining: Math.ceil((next - now) / 1000),
  };
}

async function fetchProfile(userId) {
  const supabaseUrl = getSupabaseUrl();
  const headers = getServiceHeaders();

  const res = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=id,tokens,last_daily_spin_at&limit=1`,
    { headers: { ...headers, Accept: 'application/json' } }
  );

  if (!res.ok) throw new Error('profile_fetch_failed');
  const rows = await res.json();
  return rows[0] || null;
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
    const profile = await fetchProfile(auth.userId);
    if (!profile) {
      return jsonResponse(404, { error: 'Nie znaleziono profilu' });
    }

    const status = computeSpinStatus(profile.last_daily_spin_at);

    if (event.httpMethod === 'GET') {
      return jsonResponse(200, {
        ...status,
        segments: PRIZE_SEGMENTS.map((s) => ({ label: s.label, tokens: s.tokens })),
      });
    }

    if (!status.canSpin) {
      return jsonResponse(429, {
        error: 'Możesz kręcić kołem raz na 24 godziny',
        ...status,
      });
    }

    const { segmentIndex, prizeTokens } = rollPrize();
    const newTokens = (profile.tokens || 0) + prizeTokens;
    const nowIso = new Date().toISOString();
    const nextSpinAt = new Date(Date.now() + SPIN_COOLDOWN_MS).toISOString();

    const supabaseUrl = getSupabaseUrl();
    const headers = getServiceHeaders();

    const patchRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${auth.userId}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        tokens: newTokens,
        last_daily_spin_at: nowIso,
      }),
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error('daily-spin patch failed', errText);
      return jsonResponse(500, { error: 'Nie udało się zapisać wyniku spinu' });
    }

    return jsonResponse(200, {
      prizeTokens,
      segmentIndex,
      newTokens,
      nextSpinAt,
      canSpin: false,
      secondsRemaining: Math.ceil(SPIN_COOLDOWN_MS / 1000),
      label: PRIZE_SEGMENTS[segmentIndex].label,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: err.message || 'Server error' });
  }
};
