# 3. Templates (drafts; nothing has been sent)

## Facts these may use (all from the repo/website: `apps/web/src/pages/Help.tsx`, `Landing.tsx`)

- Free for shoppers; free for businesses ("no subscriptions or in-app purchases").
- Digital stamp cards: the shop chooses the reward and stamps needed ("collect 8 stamps, get a free coffee"), and can change it.
- No special hardware: any phone or tablet with a camera; scan the customer's code or type their 6-character code.
- Shopper cards can be added to Apple Wallet or Google Wallet.
- Set-up described by the product as "minutes": add address, pin location, short description, choose reward.
- Weekly AI business coaching summaries from the shop's own visit/review/reward data.
- Shoppers can ask for a shop to join; we can say a number only when the real count (`requested_shops.request_count`) supports it.

**Do not claim:** results ("increase repeat visits by X%"), number of shops/members, "trusted by", partnerships, a competitor's weakness, or that we know the owner. Do not use the Fidel/card-linking or SumUp features in outreach (not live for every shop). Founder name/legal name: owner to fill.

Merge fields: `{{shop_name}}`, `{{town}}`, `{{request_count}}` (only if >=5, else delete that line), `{{sender_name}}`, `{{LEGAL_NAME}}`, `{{POSTAL_ADDRESS}}`, `{{where_found}}` (e.g. "the contact address on your website"). Every email is sent only after human approval and only to company role addresses (see 01).

Footer on all emails (required text):

> You are receiving this once because {{where_found}} suggested you run {{shop_name}}. We are {{LEGAL_NAME}}, {{POSTAL_ADDRESS}}. We will not email again unless you reply. To make sure of that, reply STOP or click here: {{optout_link}}. Privacy notice: https://www.the-loyalty-loop.com/legal/privacy-notice.pdf

## Email templates

### E1 Cafe

Subject: A digital stamp card for {{shop_name}}, free

> Hi {{shop_name}} team,
>
> I'm {{sender_name}} from The Loyalty Loop, a loyalty-card app for independent shops. {{request_count}} people near {{town}} have asked for {{shop_name}} to be on it. *(delete if no real count)*
>
> It replaces the paper stamp card: you choose the reward ("8 stamps, a free coffee"), staff scan a customer's code with any phone, and the card sits in their Apple or Google Wallet. It's free for you and for customers, with no hardware.
>
> If it's useful, setting up takes a few minutes: https://www.the-loyalty-loop.com/signup/owner
> If not, no problem, and you won't hear from us again.
>
> {{sender_name}}
> {{footer}}

### E2 Salon / barber

Subject: Loyalty card for {{shop_name}} clients: free, no hardware

> Hi {{shop_name}},
>
> I'm {{sender_name}} at The Loyalty Loop. It lets a salon run a simple loyalty card ("every sixth trim free", you set the rule) on the phone or tablet you already have: scan the client's code, add the stamp, done. Clients keep the card in their Apple or Google Wallet. It costs nothing for the salon or the client.
>
> It also sends a short weekly summary of visits and reviews from your own data, if you want it.
>
> Details and sign-up: https://www.the-loyalty-loop.com/signup/owner. If it's not for you, ignore this; we won't follow up.
>
> {{sender_name}}
> {{footer}}

### E3 Independent shop

Subject: Replacing paper stamp cards at {{shop_name}}

> Hi {{shop_name}} team,
>
> The Loyalty Loop is a free app that gives independent shops a digital stamp card. You pick the reward and how many stamps earn it, and you can change it whenever you like. Customers who already hold a paper card can bring it in and you can match their progress when they join.
>
> No terminal or printer: any phone with a camera scans the customer's code. Free for the shop, with no subscriptions.
>
> If you'd like to look, it's here: https://www.the-loyalty-loop.com/signup/owner
>
> {{sender_name}}
> {{footer}}

## First-DM templates (manual, one at a time, from the real account; only to businesses cleared per 01)

Keep to two or three sentences; no links in the first DM if possible (reduces spam flags); stop at the first "no".

### D1 Cafe
> Hi! I'm {{sender_name}} from The Loyalty Loop, a free digital stamp-card app for independent cafes (you set the reward, staff scan with a phone). Would it be okay if I sent you a link? No worries if not.

### D2 Salon
> Hi {{shop_name}}, I'm {{sender_name}} from The Loyalty Loop. It's a free loyalty card for salons: set your own reward, scan clients with the phone you already have. Happy to send details if you're interested, and no problem if not.

### D3 Independent shop
> Hi! I'm {{sender_name}} from The Loyalty Loop, a free app that replaces paper stamp cards for independent shops. Could I send you a quick link to look at? Totally fine to say no.

Opt-out handling for DMs: "No" or no reply after one follow-up = add to suppression with the handle/place_id.

## Review checklist before approving any draft
- Every fact traceable to the list at the top or to the shop's own website.
- Count line present only if true. No guessing a first name.
- Footer complete; recipient is a company role address (or the message is a manual DM per 01).
