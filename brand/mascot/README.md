# Mascot concepts

Three mascot concepts for The Loyalty Loop, each in six poses, in light and dark versions. **Concept art for the owner to choose from. Nothing here is wired into any app or website.**

Open `concepts.png` first (one-page contact sheet: all 18 poses on paper and on near-black, plus 96/64/48/32 px checks). `sizes.png` shows all poses at 48 and 32 px.

**Decision: the owner chose Whirl (2026-11-15).** Dot and Pip are kept here only for reference.

## The three concepts

| Name | Character | How it comes from the loop | Personality |
|---|---|---|---|
| **Dot** | Round blob with a leaf sprout, stubby arms and feet | The four-part loop mark sits on its tummy as a badge; palette is the brand olive/orange/rust | Friendly and a bit daft. Always pleased you came. |
| **Whirl** | The loop itself as a body (tilted), with big googly eyes, noodle arms and legs | The body is the real four-blade mark, tilted and outlined | Cheeky. Teases you kindly, cheers loudest. |
| **Pip** | The logo exactly as drawn, with a small quiet face and floating mitten hands (no limbs) | The body is the mark with the centre filled and a face on it; it spins on "reward" | Calm and dry. Never shouts. |

Poses (every concept): wave, stamping a card, celebrating a reward, sleepy (empty screen), thinking, thumbs-up.

## Recommendation: Dot

Dot is the one I would pick for onboarding and empty screens.

- It is the clearest at 48 px (a round silhouette with a face survives any size, see `sizes.png`).
- It has the most room for warmth and humour, which is what the owner asked for ("no personality").
- It still belongs to the brand: palette and the loop badge are on every pose.
- Its weakness: the link to the loop is the badge only, so it could read as "an orange" (the sprout leaf). If the owner wants the logo to be unmistakable, Pip is the safer brand fit and Whirl the funnier one.
- Whirl is the funniest but busiest; at 32 px the blades and eyes merge. Pip is the most on-brand and calmest, but the hand-less poses (stamping, thumbs-up) are the weakest drawings of the set.

## Files

- `svg/<name>-<pose>.svg` light version (paper or white backgrounds); `svg/dark/<name>-<pose>.svg` for near-black (`#121714`). Names: `dot`, `whirl`, `pip`; poses: `wave`, `stamp`, `celebrate`, `sleepy`, `think`, `thumbs`.
- `png/` and `png/dark/`: 512 px transparent exports of the same.
- `concepts.png` contact sheet, `sizes.png` small-size check.
- `src/build.py` writes the SVGs (all shapes hand-written; the brand mark paths are read from `brand/loyalty-loop-mark-colour.svg`). `src/render.py` renders PNGs and the sheets with headless Chrome (path in the script is Windows Chrome).

Regenerate: `python brand/mascot/src/build.py && python brand/mascot/src/render.py`.

## Verified

- All 36 SVGs generate and render in Chrome, and I looked at the contact sheet and several individual PNGs after the final render.
- Light versions on paper `#F8E4C6`; dark versions on `#121714`. In dark, blade colours switch to the brand reversed palette (`#B4C386`, `#EE9A52`, `#E2784A`) and outlines become cream.
- Small sizes: 96, 64, 48 and 32 px checked visually in `concepts.png` and `sizes.png`. Dot reads clearly at 32 px. Whirl reads at 48 px but is busy at 32. Pip reads as the logo with a face at all sizes; its small mittens vanish at 32.

## Not verified / still a concept

- Not tested in either app, on a real phone, as an app icon, in a splash screen, or in email.
- Not animated. The poses are static; any motion (wave, reward spin) is a later job.
- Pip's thumbs-up and hands are the roughest drawings and would need another pass if chosen.
- Dark-mode colours were chosen by eye on `#121714`; the dark mode being built separately may use different surfaces.
- No names have been checked for trademark or clashes. Names are working titles.
- Drawn for a 1:1 square at 256 units; no wide or hero artwork yet.
- The onboarding copy that goes with the mascot is in `docs/onboarding-voice.md`.
