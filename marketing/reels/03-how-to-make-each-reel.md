# How to make each reel

## What was and was not verified (read first)
Verified by reading the public pages on 2026-11-15 (nothing installed or run):
- **Raylight** (raylight.app): web-based 3D motion-design editor by "Frames of Motion Inc."; free plan, 1080p 60 fps with a "Made in Raylight" badge; 4K and no badge from $12/mo; also a Mac capture app and an MCP server. No installer on its pages.
- **Shotbase** (shotbase.com): **macOS-only** screenshot and screen-recording app with auto-zoom; 7-day trial, then Pro ($13/mo yearly, $25 monthly) is needed to export. Not free long-term. No Windows version.
- **AutoAE** (autoae.online): web service of motion-graphics templates plus a skill for AI agents. Free: 500 credits, about 5 downloads, 720p, watermark, non-commercial only. Its install command, `npx skills add https://autoae.online`, fetches code from that website; **no publisher name and no source repository are shown**.

NOT verified: that any of these tools work as advertised (nothing was run), the reel's claim "free tools" beyond the pricing pages above, the third-party-claims on their sites, Raylight/AutoAE legal pages, and how AutoAE's skill behaves. The reel looks ad-style; treat its claims as marketing. The "ready-made templates" for Raylight and the "cursor zoom" for Shotbase were read from the creator's description, not tested.

The user's machine is Windows, so Shotbase cannot run there (use a Mac, or `/video-edit`'s punch-ins).

## Where `/video-edit` lives
`.claude/skills/video-edit` exists in the main checkout, not in this worktree. Its setup (ffmpeg, Node, Python venv) is described in its SKILL.md; ffmpeg is now installed per the project notes. It cuts talking-head clips, punches in, adds captions, and builds animated UI inserts through HyperFrames. Its hard rules apply: safe zone (top 220, bottom 450 px), no covering the face, no em dashes on screen, real numbers only, credit other creators.

## The common pipeline (all 10 reels)
1. Script: take the voiceover from `01-content-calendar.md`. Read it aloud twice; cut anything over ~70 words per 30 s.
2. Record: talking-head clips to camera (phone, 9:16, window light), plus screen captures from `02-screen-recording-shot-list.md`.
3. Hook montage (first 3-7 s, as in the source reel): 3-4 fast cuts of the best app moments, then to camera. The source reel also uses "screenshots of high view counts" as proof; do that only with your own real analytics, never a made-up number.
4. Edit with `/video-edit`: drop the talking-head clips in Downloads, run the skill; it picks takes, cuts dead air, punches in, captions.
5. Add app mockups (optional, see below) as inserts on the screen-recording beats.
6. Export 9:16, check inside the safe zone, review on a phone.
7. Post manually. Nothing here posts anything.

## Per-reel tool plan
| Reel | Talking head | Screen content | Mockup/motion extra |
|---|---|---|---|
| 1 App demo | yes, short | S1,R2,S4,S5,R3 | phone mockup of S1 (Raylight optional) |
| 2 Why customers don't return | yes | S1, R3 | text animation via `/video-edit` |
| 3 Stamp card vs app | yes | S1, R4 | split-screen with ffmpeg or `/video-edit` insert |
| 4 Win-back | yes | R4, R5, S7 | mockup of S7 notification |
| 5 Testimonial | owner footage | their own card | `/video-edit` captions only |
| 6 Behind the scenes | yes | real change | none |
| 7 Shopper POV | optional | S1,S2,S6,S8 | 3D phone mockup |
| 8 Setup speedrun | no | R1, R7 | timer overlay |
| 9 Myth bust | yes | R3, S3 | none |
| 10 Reward moment | no | S4,S5,R2,R6 | slow-mo, one mockup |

## Using each tool (only if you decide to adopt it, see `04-tool-verdict.md`)
- **Raylight:** in the browser, start from a template, drop in screenshots (S1, S5, R3), export 1080p 60 fps MP4. Free export carries a badge, so pay or skip for public reels. Use the result as a 3-5 s insert or the hook montage.
- **Shotbase (Mac only):** record the screen, let it auto-zoom to taps. For phone screens, record the phone natively and use the `/video-edit` punch-in instead.
- **AutoAE:** only after you have read what its skill does. A safer path is the AutoAE website editor without the `npx` installer, with the free watermarked output used for testing only (non-commercial).
- **Instead of all three:** `/video-edit` insert recipes (animated UI inserts, kinetic text) cover most beats; for a phone-frame mockup use any screenshot-in-frame template or build it as a HyperFrames insert.

## Time budget per reel (planning guess, not measured)
Script 15 min, record 30 min, edit with `/video-edit` 2-3 render rounds, review on phone 10 min.
