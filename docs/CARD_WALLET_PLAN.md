# Card wallet: other shops' loyalty cards in the shopper app

Status: implemented locally by Codex 2026-10-18; hosted migration/deployment blocked by automatic approval review. No OTA/build/commit/push. Reviewer: Claude. Device and real-scanner acceptance remain pending.

Local v1: typed entry only (camera store-build linkage unproven; app.json has no camera plugin). Co-op, Lidl Plus, Costa and Greggs are withheld until stable barcodes are tested. All eight formats render through pinned bwip-js/generic and react-native-svg. EAN-13 and Code128 pass an independent raster decoder locally; this is not physical scanner proof. SecureStore caches individual cards and clears on sign-out/account switch. Optional keep-awake is guarded before loading the existing module. Encrypted recovery export includes this table locally and must only deploy after the migration. See CLAUDE_HANDOFF.md for checks and release gates.

## What it is

Shoppers keep their other loyalty cards (Nectar, Tesco Clubcard, Boots Advantage and so on) in the Loyalty Loop app and show the barcode at the till. Our own shop rewards stay the main feature; the wallet is an extra that brings people back into the app, where they also see local offers.

## What it is not

- No points balances, personalised offers, Clubcard Prices or Nectar Prices. These chains have no public API.
- Never ask for, store or send a shopper's password for another company's account. No scraping.
- No brand logos, brand colours or wording that suggests we are partnered. Use plain text names and our own generic card styling. Copy says "Show your Nectar card here", never "Get your Nectar benefits here".
- Add a line on the add-card screen: "Some offers still need switching on in the shop's own app."

## Shopper flow

1. Wallet section: "My other cards", as a pop-up sheet from the shopper home or profile (user prefers sheets and colour, see design notes).
2. Add card: pick a brand from a list, or "Other card". Then scan the card's barcode with the camera, or type the number in.
3. View card: a large, high-contrast barcode on a white background, the number written underneath, and the label. Keep the screen awake while it is open, if that can be done without a new native module.
4. Edit the label, or delete the card (with a confirm step).
5. Optional, phase 2: "Add to Apple Wallet" using the existing .pkpass signer as a generic pass with that barcode.

## Data model (Supabase)

New table `public.shopper_external_cards`:

| column | type | notes |
|---|---|---|
| id | uuid pk default gen_random_uuid() | |
| user_id | uuid not null references auth.users on delete cascade | |
| brand_key | text not null | from the brand list, or `other` |
| label | text not null, 1-40 chars | shopper-editable name |
| card_number | text not null, 4-64 chars | exactly what the scanner reads, or what was typed |
| barcode_format | text not null | `ean13`, `ean8`, `code128`, `code39`, `qr`, `pdf417`, `itf14`, `upc_a` |
| created_at / updated_at | timestamptz | |

- RLS on: select/insert/update/delete only where `user_id = auth.uid()`. No retailer or anon access. Admin pages must not list these.
- Unique on (user_id, brand_key, card_number) so the same card can't be added twice.
- Cap of 30 cards per user (trigger or check in an RPC).
- Account deletion: the cascade covers it. Confirm `delete-my-account` removes the auth user so the cascade fires, and include the table in any data export.

## Security notes

- A card number can be worth money: someone holding a Nectar barcode can spend those points. Treat it as sensitive. Never log it, never send it to Sentry, PostHog or other analytics (only log brand_key), and mask it in any error message.
- It is stored server-side so it survives a phone change, protected by RLS and Supabase's at-rest encryption. Column-level encryption is not needed for v1.
- Also cache it on the device for offline use at the till. A barcode must show with no signal. Use expo-secure-store if the data fits, otherwise a plain local cache that is cleared on sign-out.
- Check scanned input: strip whitespace, enforce length, and check the EAN/UPC check digit before saving.

## Brands for v1 (text only)

Nectar, Tesco Clubcard, Boots Advantage, Co-op Membership, Morrisons More, Superdrug Health & Beautycard, Waitrose myWaitrose, Lidl Plus, Costa Club, Greggs, IKEA Family, plus `other`.

- Typed entry uses evidence-backed brand defaults with a Change format toggle, per the owner's 18 October follow-up. Unconfirmed brands use code128 with the picker visible. See CARD_WALLET_FORMAT_EVIDENCE.md for sources and variant limits. Future scanning must store whatever the scanner reports, without replacing it with the brand default.
- Some of these (Lidl Plus, Costa, Greggs, Co-op) are app-first, and the barcode in their app may rotate or change. Before listing them, test with a real card or app barcode. If the code isn't a stable number, leave the brand out of the list and note it in the handoff.

## Technical constraints

- **Ship by OTA where possible** (user rule). Avoid new native modules. `expo-camera` and `react-native-svg` are already in apps/shopper/package.json. Before relying on `expo-camera`, confirm it is linked in the current store builds (check its config plugin in app.json/app.config). If it is not, typed entry ships by OTA and scanning waits for the next native build.
- Barcode drawing: use a pure-JS encoder that outputs bars, drawn with react-native-svg. No native barcode library. Test that a real till or scanner app reads the rendered codes (EAN-13, Code128 at least).
- Screen brightness: `expo-brightness` is not installed, and adding it is native. Leave it out of v1 and use a white, high-contrast layout instead.
- The OTA-gotchas memory applies: never `require()` a native module that may be missing from the installed binary.

## Done when

- Migration applied, with RLS tested: user A cannot read or change user B's cards (integration test under apps/api/test/integration).
- A shopper can add (scan or type), view, rename and delete cards on Android and iOS, and saved cards show with no network.
- Real-world scan check: barcodes shown on the phone scan correctly with a barcode reader app for at least Nectar and Clubcard (or same-format test numbers).
- No card numbers in logs, Sentry or analytics.
- Store listing / website copy updated only after the user signs it off.
