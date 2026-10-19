# Owner voice line (Twilio → Claude), basic version

Call the Twilio number, enter the PIN, and describe a feature. Twilio transcribes the call, the request is saved to `voice_requests`, and you get a confirmation text. A Claude session then picks it up and builds it **on a branch only**. Phone requests never deploy or touch the live database.

## Files
- `supabase/functions/voice-call/index.ts`: the TwiML webhook. Checks the Twilio signature, then caller ID, then the PIN, records the call, saves the transcript and sends an SMS.
- `supabase/migrations/20261018180000_voice_requests.sql`: the request table. Only the service role can reach it (RLS on, no policies).
- `supabase/config.toml`: `voice-call` with `verify_jwt = false`, because Twilio can't send a JWT.

## Setup (owner steps)
1. Create a Twilio account and buy a UK voice + SMS number.
2. Set the secrets yourself. Don't paste them into chat.
   ```bash
   supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=+44... VOICE_OWNER_PHONE=+44... VOICE_PIN=<6+ digits> VOICE_TRIGGER_KEY=<long random string>
   ```
3. Apply the migration and deploy the function. Claude does this after you approve it.
4. In the Twilio console, under the number's Voice settings, set "A call comes in" to Webhook, **POST**, with the URL `https://<project-ref>.supabase.co/functions/v1/voice-call`.
5. Pick-up worker: a scheduled Claude task on this PC that checks every 10 minutes for rows with `status='new'`. For each one it marks the row `picked`, implements the request on a new `voice/<date>-<slug>` branch, commits but doesn't push, sets the row to `done` with the branch name, and tells you. It never runs deploys, OTA updates or migrations. Those wait for your approval in the app.

## Call-me link (trial / no UK number)
Open `https://tgukdabfvvoywawmzbdo.supabase.co/functions/v1/voice-call?step=callme&key=<VOICE_TRIGGER_KEY>` and save it as a home-screen shortcut. Twilio then rings VOICE_OWNER_PHONE and the call runs the same PIN, record and transcript flow. The link can only ever ring the owner's phone. Change the key if the link leaks.

## Limits / known gaps
- Twilio's built-in transcription is English only, capped at 2 minutes, and mishears technical words. Better speech-to-text is part of the "solid" version.
- 5 requests per 24 hours.
- Caller ID can be spoofed, so the PIN is the real check. Use 6 or more digits and change it if it leaks.
- Not yet tested against a real Twilio call.
