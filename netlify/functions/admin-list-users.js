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

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const auth = await verifyAdminAuth(event);
  if (auth.error) return auth.error;

  const supabaseUrl = getSupabaseUrl();
  const params = event.queryStringParameters || {};
  const search = (params.search || '').trim();
  const limit = Math.min(200, Math.max(1, parseInt(params.limit, 10) || 100));
  const offset = Math.max(0, parseInt(params.offset, 10) || 0);

  let query = `${supabaseUrl}/rest/v1/profiles?select=id,username,email,tokens,is_admin,banned,referred_by,created_at&order=created_at.desc&limit=${limit}&offset=${offset}`;

  if (search) {
    const term = encodeURIComponent(`%${search}%`);
    query += `&or=(username.ilike.${term},email.ilike.${term})`;
  }

  const [usersRes, countRes, statsRes, actionsRes] = await Promise.all([
    fetch(query, { headers: { ...getServiceHeaders(), Accept: 'application/json', Prefer: 'count=exact' } }),
    fetch(`${supabaseUrl}/rest/v1/profiles?select=id`, {
      headers: { ...getServiceHeaders(), Accept: 'application/json', Prefer: 'count=exact' },
    }),
    fetch(
      `${supabaseUrl}/rest/v1/profiles?select=tokens,created_at`,
      { headers: { ...getServiceHeaders(), Accept: 'application/json' } }
    ),
    fetch(
      `${supabaseUrl}/rest/v1/admin_actions?select=id,admin_email,target_user_id,action,amount,created_at&order=created_at.desc&limit=20`,
      { headers: { ...getServiceHeaders(), Accept: 'application/json' } }
    ),
  ]);

  if (!usersRes.ok) {
    const text = await usersRes.text();
    return jsonResponse(500, { error: text.slice(0, 300) });
  }

  const users = await usersRes.json();
  const contentRange = usersRes.headers.get('content-range') || '';
  const totalMatch = contentRange.match(/\/(\d+)/);
  const total = totalMatch ? parseInt(totalMatch[1], 10) : users.length;

  let stats = { totalUsers: total, totalTokens: 0, signupsToday: 0, signupsWeek: 0 };
  if (statsRes.ok) {
    const all = await statsRes.json();
    const now = Date.now();
    const dayMs = 86400000;
    stats = {
      totalUsers: all.length,
      totalTokens: all.reduce((sum, u) => sum + (u.tokens || 0), 0),
      signupsToday: all.filter((u) => now - new Date(u.created_at).getTime() < dayMs).length,
      signupsWeek: all.filter((u) => now - new Date(u.created_at).getTime() < dayMs * 7).length,
    };
  }

  const recentActions = actionsRes.ok ? await actionsRes.json() : [];

  return jsonResponse(200, {
    users,
    total,
    stats,
    recentActions,
    adminEmail: auth.email,
  });
};
