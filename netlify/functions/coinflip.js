const {
  corsHeaders,
  jsonResponse,
  getSupabaseUrl,
  getServiceHeaders,
} = require('./_lib/admin-auth');

const MIN_BET = 5;
const MAX_BET = 10000;

async function verifyUserToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: jsonResponse(401, { error: 'Zaloguj się, aby grać w coinflip' }) };
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

  const res = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=id,tokens&limit=1`,
    { headers }
  );

  if (!res.ok) throw new Error('profile_fetch_failed');
  const rows = await res.json();
  return rows[0] || null;
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

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Nieprawidłowe dane żądania' });
  }

  const bet = Math.floor(Number(body.bet));
  const choice = body.choice;

  if (!Number.isFinite(bet) || bet < MIN_BET) {
    return jsonResponse(400, { error: `Minimalna stawka to ${MIN_BET} żetonów` });
  }

  if (bet > MAX_BET) {
    return jsonResponse(400, { error: `Maksymalna stawka to ${MAX_BET.toLocaleString('pl-PL')} żetonów` });
  }

  if (choice !== 'heads' && choice !== 'tails') {
    return jsonResponse(400, { error: 'Wybierz orzeł lub reszkę' });
  }

  try {
    const profile = await fetchProfile(auth.userId);
    if (!profile) {
      return jsonResponse(404, { error: 'Nie znaleziono profilu' });
    }

    const balance = profile.tokens || 0;
    if (bet > balance) {
      return jsonResponse(400, { error: 'Za mało żetonów na tę stawkę' });
    }

    const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = outcome === choice;
    const newTokens = balance - bet + (won ? bet * 2 : 0);

    const supabaseUrl = getSupabaseUrl();
    const headers = getServiceHeaders();

    const patchRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${auth.userId}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ tokens: newTokens }),
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error('coinflip patch failed', errText);
      return jsonResponse(500, { error: 'Nie udało się zapisać wyniku gry' });
    }

    return jsonResponse(200, {
      won,
      outcome,
      choice,
      bet,
      profit: won ? bet : -bet,
      newTokens,
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: err.message || 'Server error' });
  }
};
