# Supabase auth email templates

These are the hosted templates for project `tgukdabfvvoywawmzbdo`. Supabase keeps
the live copies; these files are the source to paste from. `supabase/config.toml`
does not configure auth, so nothing here is applied automatically.

| File | Dashboard place | Subject |
|---|---|---|
| `confirm-signup.html` | Authentication > Emails > Confirm signup | `Your Loyalty Loop code: {{ .Token }}` |
| `reset-password.html` | Authentication > Emails > Reset password | `Your Loyalty Loop password code: {{ .Token }}` |

Both show the 6-digit code (`{{ .Token }}`) that the apps and website ask for
(`supabase.auth.verifyOtp`, type `signup` or `recovery`). Both also keep the old
link (`{{ .ConfirmationURL }}`) as a fallback while app versions that say "tap the
link" are still on phones. Remove the link only once every app version on phones
has the code screens.

Auth settings to check (Authentication > Providers > Email): "Confirm email" on,
"Email OTP length" 6, "Email OTP expiration" 3600 seconds or less.
