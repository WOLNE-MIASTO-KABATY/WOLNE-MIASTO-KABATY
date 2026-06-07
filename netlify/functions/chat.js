const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Brak OPENROUTER_API_KEY w Netlify Environment Variables' }),
    };
  }

  try {
    const { messages, model } = JSON.parse(event.body || '{}');
    if (!Array.isArray(messages) || !messages.length) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Wymagana tablica messages' }),
      };
    }

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.URL || 'https://dyskhub.pl',
        'X-Title': 'DyskiHub',
      },
      body: JSON.stringify({
        model: model || 'deepseek/deepseek-chat',
        messages,
      }),
    });

    const text = await res.text();
    return {
      statusCode: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Server error' }),
    };
  }
};
