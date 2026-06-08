const {
  corsHeaders,
  jsonResponse,
  verifyAdminAuth,
  getSupabaseUrl,
  getServiceHeaders,
} = require('./_lib/admin-auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const auth = await verifyAdminAuth(event);
  if (auth.error) return auth.error;

  try {
    const { userId, amount } = JSON.parse(event.body || '{}');
    const delta = parseInt(amount, 10);

    if (!userId || !Number.isFinite(delta) || delta === 0) {
      return jsonResponse(400, { error: 'Podaj userId i ilość żetonów (różną od zera)' });
    }

    if (Math.abs(delta) > 100000) {
      return jsonResponse(400, { error: 'Maksymalna zmiana to 100 000 żetonów' });
    }

    const supabaseUrl = getSupabaseUrl();
    const headers = getServiceHeaders();

    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=id,username,email,tokens&limit=1`,
      { headers: { ...headers, Accept: 'application/json' } }
    );

    if (!profileRes.ok) {
      return jsonResponse(500, { error: 'Nie udało się odczytać profilu' });
    }

    const profiles = await profileRes.json();
    if (!profiles.length) {
      return jsonResponse(404, { error: 'Nie znaleziono użytkownika' });
    }

    const profile = profiles[0];
    const newTokens = Math.max(0, (profile.tokens || 0) + delta);

    const updateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ tokens: newTokens }),
    });

    if (!updateRes.ok) {
      const text = await updateRes.text();
      return jsonResponse(500, { error: text.slice(0, 300) });
    }

    const updated = (await updateRes.json())[0];

    await fetch(`${supabaseUrl}/rest/v1/admin_actions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        admin_email: auth.email,
        target_user_id: userId,
        action: delta > 0 ? 'grant_tokens' : 'deduct_tokens',
        amount: delta,
      }),
    });

    return jsonResponse(200, {
      user: updated,
      previousTokens: profile.tokens,
      newTokens: updated.tokens,
      delta,
    });
  } catch (err) {
    return jsonResponse(500, { error: err.message || 'Server error' });
  }
};
