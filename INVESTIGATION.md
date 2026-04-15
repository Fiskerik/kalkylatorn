# Investigation: Auth/session state and payment flow

## Scope
This review is based on static analysis of the extension code in `event-attendee-extension/`.

## 1) Why you cannot log out and then log in again

### Primary cause
`handleSignOut` clears local session/profile/credits state, but it **does not revoke the Supabase server-side session/token**.

- Code clears only local storage/state (`session`, `profile`, credits) and updates UI. No `/auth/v1/logout` call is made.
- If Supabase still has a valid session and callback/token flow reuses it, the extension may appear to “bounce” back into authenticated state or behave inconsistently between tabs.

### Additional contributing issue
There are **two callback handling paths**:
- `sidepanel.js` has a `handleAuthCallback()` that parses `window.location.hash`.
- `signin-callback.js` also handles callback and writes session via background message.

That split can create state timing/race confusion after repeated login/logout cycles, especially if users switch between Google/magic-link and password flows.

## 2) Why default state is “logged in as no user”

### Root issue
`syncAccountUI()` only hides the account badge when no email exists, but it does **not explicitly show a signed-out placeholder state**.

- `accountBadge` visibility is toggled solely from email presence (`state.profile?.email || state.session?.user?.email`).
- If stale/incomplete session shape is present (e.g., token but missing `user.email`, or session restored before profile resolves), UI can look in-between states (not clearly signed in, not clearly signed out).

### Data shape mismatch risk
Some auth responses can omit a complete `user` object at first. `syncProfile()` hard-requires both `access_token` and `session.user.id`; if `user.id` is missing, profile sync never runs, leaving state partially initialized.

## 3) Why payment flow does not work

### Most likely cause from repo contents
The extension opens checkout on `https://prospectin.vercel.app/checkout?...`, but this repo only contains the extension; no checkout/API implementation is present here.

The setup doc explicitly says these are required but currently missing:
- `/api/create-checkout.js`
- `/api/stripe-webhook.js`
- `/app/checkout/page.tsx`

Without those, payments cannot complete end-to-end from extension → Stripe → webhook → Supabase credit update.

### Other likely production blockers
From `SETUP.md`, payment also depends on:
- Stripe products + valid price IDs
- Vercel env vars (Stripe and Supabase service role)
- Supabase RPC `add_credits(uid, amount)`
- `profiles` table + RLS/policies

Any missing item in that chain breaks credit updates even if checkout opens.

## 4) Possible culprits (prioritized)

1. **Missing backend/webapp checkout pieces** (highest likelihood).
2. **No explicit Supabase sign-out API call** in extension logout path.
3. **Split callback logic** across `sidepanel.js` and `signin-callback.js` causing auth-state timing issues.
4. **Partial session objects** (token present, `user.id/email` missing) leading to UI limbo.
5. **No robust auth-state event handling in sidepanel** for `AUTH_STATE_CHANGED` (message is emitted by background but not consumed in sidepanel).
6. **Payment-credit sync relies on polling only** (15s interval) and silent failures in `syncProfile()` can hide backend issues.

## Suggested debug logs to add (targeted)

To reproduce and isolate quickly, add logs around:

- Login success payload shape (`access_token`, `user.id`, `user.email`).
- Logout: before/after local clear, and Supabase logout response.
- Callback page: token parse result and background write response.
- `syncProfile()` request URL/user id and response status/body when not OK.
- Payment open: emitted checkout URL + `user_id` query value.
- Poll cycle: each sync attempt, previous credits vs current credits.

These logs will immediately show whether failures are UI-state only, token-shape issues, or missing backend/webhook path.
