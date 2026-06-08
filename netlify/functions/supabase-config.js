const { corsHeaders, jsonResponse } = require('./_lib/admin-auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return jsonResponse(503, { error: 'Supabase nie jest skonfigurowany' });
  }

  return jsonResponse(200, { url, anonKey });
};
