const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || '';
}

function getServiceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function verifyAdminAuth(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: jsonResponse(401, { error: 'Brak autoryzacji' }) };
  }

  const token = authHeader.slice(7);
  const supabaseUrl = getSupabaseUrl();
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return { error: jsonResponse(500, { error: 'Brak konfiguracji Supabase' }) };
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  });

  if (!res.ok) {
    return { error: jsonResponse(401, { error: 'Nieprawidłowy lub wygasły token' }) };
  }

  const user = await res.json();
  const email = (user.email || '').toLowerCase();
  const admins = getAdminEmails();

  if (!email || !admins.includes(email)) {
    return { error: jsonResponse(403, { error: 'Brak uprawnień administratora' }) };
  }

  return { user, email };
}

module.exports = {
  corsHeaders,
  jsonResponse,
  getAdminEmails,
  getSupabaseUrl,
  getServiceHeaders,
  verifyAdminAuth,
};
