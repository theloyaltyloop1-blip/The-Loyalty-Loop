// Cold outreach templates. Placeholders: {{firstName}} {{business}} {{city}} {{category}}
// {{bookingUrl}} {{signupUrl}} {{senderName}}
// EDIT the [bracketed] bits in email 3 with your real story before sending.

export const EMAILS = [
  {
    step: 1,
    name: "pain-points",
    delayDays: 0,
    subject: "{{business}}'s paper loyalty cards",
    body: `Hi {{firstName}},

Quick one — most {{category}}s I speak to in {{city}} have the same 3 headaches with loyalty:

- Paper stamp cards get lost, forgotten or faked
- You have no idea who your regulars are, or when they stop coming
- No easy way to bring a quiet customer back without paying for ads

The Loyalty Loop fixes all three: digital stamp cards on your customers' phones, a dashboard showing who's visiting, and automatic "we miss you" emails to customers who've drifted.

Worth a 15-min call to see if it fits {{business}}?
Book a slot: {{bookingUrl}}

Or try it free now: {{signupUrl}}

{{senderName}}
The Loyalty Loop`,
  },
  {
    step: 2,
    name: "features-benefits",
    delayDays: 3,
    subject: "Re: {{business}}'s paper loyalty cards",
    body: `Hi {{firstName}},

Following up with what {{business}} would actually get:

- Digital stamp, points or tiered cards → customers never lose a card, so more of them come back
- QR scan at the till (or a short code) → stamping takes 2 seconds, no extra kit
- Owner dashboard → see your regulars, visit trends and reward redemptions in one place
- Win-back emails → lapsed customers get nudged automatically
- Targeted promos & announcements → fill quiet days without paying for ads
- Staff accounts & reviews → your team stamps, you stay in control

Setup takes about 10 minutes.

Can I show you in a 15-min call? {{bookingUrl}}
Or sign up free: {{signupUrl}}

{{senderName}}`,
  },
  {
    step: 3,
    name: "my-story",
    delayDays: 7,
    subject: "Why I built this (last email)",
    body: `Hi {{firstName}},

Last note from me — I wanted to share why I built The Loyalty Loop.

[YOUR STORY — e.g. While working with schools I saw how much time went into chasing people by email: newsletters ignored, reminders lost, the same few people always engaged. The tools that actually worked were simple, personal and automatic.]

[THE LINK — e.g. Then I noticed my local café doing the same thing with paper stamp cards and a clipboard. Independent shops deserve the same simple, automatic way to keep their regulars coming back that big chains have.]

So I built it — for places like {{business}}.

If that resonates, grab 15 minutes with me: {{bookingUrl}}
Or try it free: {{signupUrl}}

Either way, thanks for reading.
{{senderName}}`,
  },
];

// LinkedIn: connection note must be <= 300 chars. Sent MANUALLY (see README).
export const LINKEDIN = [
  {
    step: 1,
    name: "connect-note",
    body: `Hi {{firstName}} — I help independent {{category}}s in {{city}} replace paper loyalty cards with digital ones that bring regulars back automatically. Would love to connect.`,
  },
  {
    step: 2,
    name: "pain-points-dm",
    body: `Thanks for connecting, {{firstName}}! Curious — how does {{business}} handle loyalty today? Most shops I speak to lose track of regulars and have no easy way to win back quiet ones. The Loyalty Loop fixes that (digital stamp cards + automatic win-back emails). Open to a 15-min call? {{bookingUrl}}`,
  },
  {
    step: 3,
    name: "features-dm",
    body: `{{firstName}}, quick snapshot of what {{business}} would get: digital stamp/points cards, 2-second QR stamping, a dashboard of your regulars, automatic win-back emails and targeted promos. 10-min setup. Free to try: {{signupUrl}} — or I can walk you through it: {{bookingUrl}}`,
  },
  {
    step: 4,
    name: "story-dm",
    body: `Last one from me, {{firstName}} — I built The Loyalty Loop after [working with schools and seeing how much simple, automatic emails beat chasing people manually]. Local shops deserve the same. If that resonates, 15 mins here: {{bookingUrl}}`,
  },
];

export function fill(tpl, lead, cfg) {
  const vars = { ...cfg, ...lead };
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}
