# Prospect In — Setup Guide

## Flödet steg för steg

```
Användaren klickar "Export CSV"
  → ExportModal dyker upp
  → Om ≤20 attendees: direkt export, ingen inloggning krävs
  → Om >20 attendees och inte inloggad: "Full report" knappen triggar AuthModal
  → Efter inloggning: ExportModal öppnas igen automatiskt
  → Om inloggad men 0 credits: köpsektion visas i modalen
  → Köp → chrome.tabs.create → /checkout?plan=X&user_id=Y
  → /checkout anropar /api/create-checkout → Stripe Checkout
  → Stripe skickar webhook till /api/stripe-webhook
  → Webhooken kör Supabase RPC add_credits(uid, amount)
  → Extensionen poller Supabase var 15s → crediterna uppdateras
```

---

## 1. Supabase

### Tabellen `profiles`
```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  credits int not null default 0,
  has_unlimited boolean not null default false,
  updated_at timestamptz default now()
);

-- Auto-skapa profil vid signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

### RPC för att lägga till credits (webhook använder denna)
```sql
create or replace function add_credits(uid uuid, amount int)
returns void language plpgsql security definer as $$
begin
  update profiles set credits = credits + amount, updated_at = now()
  where id = uid;
end;
$$;
```

### Row Level Security
```sql
alter table profiles enable row level security;

-- Användaren kan bara läsa/uppdatera sin egen profil
create policy "users can read own profile"
  on profiles for select using (auth.uid() = id);

-- Service role (webhook) kan göra allt via service key
-- RLS bypassed med service key automatiskt
```

---

## 2. Vercel Environment Variables

Gå till Vercel Dashboard → ditt projekt → Settings → Environment Variables:

| Key | Value |
|-----|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` (eller `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (från Stripe webhook dashboard) |
| `STRIPE_PRICE_1` | Stripe Price ID för 1-pack |
| `STRIPE_PRICE_5` | Stripe Price ID för 5-pack |
| `STRIPE_PRICE_10` | Stripe Price ID för 10-pack |
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (inte anon key!) |
| `APP_PUBLIC_URL` | `https://prospectin.vercel.app` |

> ⚠️ GitHub Secrets är för GitHub Actions CI/CD — Vercel läser från sitt **eget** dashboard.

---

## 3. Stripe

1. Skapa 3 produkter i Stripe Dashboard:
   - "Prospect In — 1 rapport" → engångspris $9.99
   - "Prospect In — 5 rapporter" → engångspris $39.99
   - "Prospect In — 10 rapporter" → engångspris $69.99

2. Kopiera Price ID (börjar med `price_...`) för varje → lägg i Vercel env vars.

3. Skapa webhook i Stripe Dashboard → Webhooks → Add endpoint:
   - URL: `https://prospectin.vercel.app/api/stripe-webhook`
   - Events: `checkout.session.completed`
   - Kopiera "Signing secret" → `STRIPE_WEBHOOK_SECRET` i Vercel

---

## 4. Extension — sätt Supabase anon key

Anon key behöver sättas i `chrome.storage.local` en gång. Lägg denna rad i `background.js` `onInstalled`:

```js
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    supabaseAnonKey: "din-anon-key-här",
    supabaseUrl: "https://xxx.supabase.co",
    appUrl: "https://prospectin.vercel.app"
  });
});
```

Eller hårdkoda dem direkt som constants i `sidepanel.js` om du inte vill att de ska vara konfigurerbara.

---

## 5. Filplacering i repot

```
/api/
  create-checkout.js   ← Vercel serverless
  stripe-webhook.js    ← Vercel serverless

/app/checkout/
  page.tsx             ← Next.js checkout-sida

/event-attendee-extension/
  sidepanel.html       ← uppdaterad
  sidepanel.css        ← uppdaterad
  sidepanel.js         ← uppdaterad
  crm-export.js        ← oförändrad
  content.js           ← oförändrad
  background.js        ← oförändrad
```

---

## 6. GitHub Secrets (om du deployer via Actions)

Du behöver dessa för Vercel CLI deployment:
- `VERCEL_TOKEN` — från vercel.com/account/tokens
- `VERCEL_ORG_ID` — från `.vercel/project.json` efter `vercel link`
- `VERCEL_PROJECT_ID` — samma fil

Annars: koppla repot direkt i Vercel Dashboard → "Import Git Repository" → ingen Actions behövs.

---

## Sammanfattning av vad som saknas just nu

- [ ] Stripe produkter + price IDs skapade
- [ ] `/api/create-checkout.js` och `/api/stripe-webhook.js` tillagda i repot
- [ ] `/app/checkout/page.tsx` skapad
- [ ] Vercel env vars satta (se tabell ovan)
- [ ] Supabase `profiles` tabell + trigger + RPC skapad
- [ ] `supabaseAnonKey` hårdkodad eller satt i background.js
- [ ] Extension filer (sidepanel.html/css/js) ersatta med nya versioner
