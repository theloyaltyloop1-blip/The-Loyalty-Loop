# Handoff: credentials, expiries, and recurring maintenance

Apple imposes hard expiries on two unrelated credentials used by this
project. Neither Apple nor Supabase sends a warning before they expire —
they just silently start failing. Check the dates below every session.

## 1. Sign in with Apple — OAuth client secret

- **Expires: 2027-03-10T10:04:36.000Z.**
- What it is: a JWT that Supabase's Apple auth provider uses as the OAuth
  client secret for the *web-flow* Apple sign-in (used by the Android
  shopper app and the website). Native iOS sign-in (`signInWithIdToken`)
  does **not** use this secret and is unaffected by its expiry.
- Where it lives: Supabase Dashboard → Auth → Providers → Apple → "Secret Key
  (for OAuth)". Not stored anywhere in this repo.
- Generated with: Key ID `A2QVMBB8JN`, Services ID
  `com.theloyaltyloop.shopper.signin`, Team ID `9QSSA475TR`, signed with the
  `.p8` private key downloaded when that key was created (ES256, `iss`=Team
  ID, `sub`=Services ID, `aud`=`https://appleid.apple.com`, max lifetime
  15,777,000s = 6 months).
- **A passive health indicator already exists**: the Access Panel
  (`apps/web/src/pages/AccessPanel.tsx`, `appleSignInHealth()`) shows a red
  card on the Overview tab starting 45 days before this expiry. If you see
  that card red, or Apple sign-in on Android/web starts failing, regenerate
  the JWT and update both Supabase and the `APPLE_SECRET_EXPIRES_AT` constant
  in that file.
- **Gotcha already fixed once**: Supabase's Apple provider "Client IDs" field
  is a comma-separated list, and **order matters** — Supabase uses the
  *first* listed ID as `client_id` for the web-flow `signInWithOAuth`, even
  though native `signInWithIdToken` validates against the whole list
  order-independently. The list must be
  `com.theloyaltyloop.shopper.signin,com.theloyaltyloop.shopper` (Services ID
  first) or web sign-in breaks with `invalid_request`.

## 2. Apple Wallet Pass Type ID certificate

- **Expires: 2027-10-08.**
- What it is: the certificate that signs the `.pkpass` files the
  `create-apple-wallet-pass` Supabase Edge Function generates for the
  shopper app's "Add to Apple Wallet" button.
- Where it lives: Supabase project secrets — `APPLE_PASS_CERT_PEM`,
  `APPLE_PASS_KEY_PEM`, `APPLE_WWDR_PEM`, `APPLE_PASS_TYPE_ID`
  (`pass.com.theloyaltyloop.shopper`), `APPLE_PASS_TEAM_ID` (`9QSSA475TR`).
  Not in this repo. `supabase/functions/create-apple-wallet-pass/index.ts`
  reads them at runtime.
- To regenerate before expiry: Apple Developer Portal → Certificates,
  Identifiers & Profiles → Identifiers → Pass Type IDs →
  `pass.com.theloyaltyloop.shopper` → Create Certificate. Needs a fresh CSR
  (`openssl genrsa` + `openssl req -new`), upload it, download the new
  `.cer`, convert to PEM (`openssl x509 -inform der -in cert.der -out
  cert.pem`), then `supabase secrets set APPLE_PASS_CERT_PEM=... APPLE_PASS_KEY_PEM=...`
  with the new cert/key pair. The WWDR intermediate cert
  (`http://certs.apple.com/wwdrg4.der`) only needs replacing if Apple rotates
  it — unrelated to this expiry.
- No automatic health check exists for this one yet (unlike the Sign-In
  secret) — worth adding a similar card to the Access Panel if you're
  touching that file anyway.

## Admin access (Access Panel / AccessPanel.tsx)

Three email addresses get auto-granted the `admin` role on every
login/signup via the `ensure_current_user_bootstrap()` /
`handle_new_user()` Postgres functions (hardcoded allowlist, see
`supabase/migrations/0015_platform_access_panel_and_support.sql` onward):
- `zahihussain92@gmail.com`
- `flyhigher722@gmail.com` (the user's primary email)
- `developer@the-loyalty-loop.com`

## Apple Developer account details (for portal work)

- Team: Cotech Software Consultants Limited, Team ID `9QSSA475TR`.
- Login used for App Store Connect / Developer Portal:
  `developer@the-loyalty-loop.com`. A logged-in browser session does not
  persist between Claude sessions — expect to need the user to log back in
  each time you need the portal (Claude cannot enter passwords or complete
  2FA).
- App Store Connect API key (used for `eas submit` / `eas metadata:push`,
  stored on EAS's servers, not locally): Key ID `7TARNMWXRR` ("[Expo] EAS
  Submit"). A separate key (`MAD99TM6V5`, App Manager role, Issuer
  `8c8b3ed7-1d43-4ad7-bbfc-5a9bbd10fdb3`) was created earlier and its `.p8`
  is at `C:\Users\zahih\Downloads\AuthKey_MAD99TM6V5.p8` on the user's
  machine — useful for direct App Store Connect API calls (e.g.
  `eas metadata:push` reads it via EAS, but you can also hit
  `api.appstoreconnect.apple.com` directly with a JWT signed by this key for
  things EAS doesn't cover). Note: the **App Privacy questionnaire has no
  API** — confirmed by testing `/v1/appDataUsages` and
  `/v1/appDataUsageCategories`, both 404 "resource does not exist". It and
  screenshots are web-UI-only, no way around that.
