# DyskiHub.pl

Statyczna strona z panelem, katalogiem profili i dysków, czatem oraz integracją Netlify Functions + Supabase.

## Struktura

- `moja strona/` — frontend (HTML, CSS, JS)
- `netlify/functions/` — funkcje serwerowe (auth, chat, tokeny, admin)
- `supabase/` — schemat bazy i instrukcja konfiguracji

## Lokalnie

Otwórz `moja strona/index.html` w przeglądarce lub użyj Netlify Dev:

```bash
npx netlify dev
```

## Zmienne środowiskowe

Skopiuj `.env.example` do `.env` (lokalnie) lub ustaw w Netlify → Site configuration → Environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS`
- `OPENROUTER_API_KEY`

Plik `.env` nie trafia do repozytorium.

## Deploy

Projekt jest skonfigurowany pod Netlify (`netlify.toml`, publish: `moja strona`).
