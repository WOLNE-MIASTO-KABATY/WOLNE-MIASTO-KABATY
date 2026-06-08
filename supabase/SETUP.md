# Konfiguracja Supabase dla DyskiHub.pl

## 1. Utwórz projekt

1. Wejdź na [supabase.com](https://supabase.com) → **New project** (plan Free)
2. Zapisz hasło do bazy

## 2. Uruchom schemat

1. **SQL Editor** → **New query**
2. Wklej całą zawartość pliku [`schema.sql`](./schema.sql)
3. Kliknij **Run**

## 3. Authentication

1. **Authentication** → **Providers** → **Email** — włączony
2. Na start (testy): **Authentication** → **Settings** → wyłącz **Confirm email**
3. Na produkcji włącz potwierdzenie e-maila z powrotem

## 4. Klucze API

**Project Settings** → **API**:

| Klucz | Gdzie w Netlify |
|-------|-----------------|
| Project URL | `SUPABASE_URL` |
| anon public | `SUPABASE_ANON_KEY` |
| service_role (secret!) | `SUPABASE_SERVICE_ROLE_KEY` (scope: Functions) |

## 5. Netlify Environment Variables

W **Site configuration** → **Environment variables** dodaj:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ADMIN_EMAILS=marcelkuczynski47@gmail.com,braszkamc@gmail.com
```

Scope dla `SERVICE_ROLE` i `ADMIN_EMAILS`: **Functions** (lub All).

## 6. Konta administratorów

Po deployu zarejestruj się na stronie używając **dokładnie**:

- `marcelkuczynski47@gmail.com`
- `braszkamc@gmail.com`

Trigger w bazie automatycznie ustawi `is_admin = true`.

## 7. Deploy

```bash
git push origin main
```

W Netlify → **Deploys** → poczekaj na **Published**.

## 8. Test

1. Zarejestruj konto testowe (zwykły user)
2. Zaloguj się jako admin → w menu profilu: **Panel admina**
3. Nadaj żetony testowemu kontu
4. Zaloguj się jako test user → sprawdź saldo

Lokalnie uruchom `netlify dev` w katalogu repo (wymaga zmiennych z `.env.example`).

## 9. Bezpieczeństwo żetonów

- Użytkownik może **tylko odejmować** żetony (`spend_tokens` RPC)
- Doładowanie pakietów i nadawanie przez admina idzie przez **Netlify Functions** (service role)
- Nie udostępniaj `SUPABASE_SERVICE_ROLE_KEY` w frontendzie
