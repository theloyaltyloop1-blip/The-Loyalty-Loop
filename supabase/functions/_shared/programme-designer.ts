// The AI programme builder's prompt and answer handling. Pure (no network), so
// node --test can check it. The edge function (design-programme) does the HTTP.
//
// The model never writes code. It writes a rules document in the format of
// programme-rules.ts; validateRules() checks it here and the database checks it
// again before anything is saved.

import { validateRules, type ProgrammeRules } from './programme-rules.ts'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ShopContext {
  name?: string | null
  category?: string | null
  currencySymbol?: string | null
}

export interface Unsupported {
  request: string
  closest: string
}

export interface DesignAnswer {
  reply: string
  rules: ProgrammeRules | null
  unsupported: Unsupported[]
}

export const MAX_MESSAGES = 24
export const MAX_MESSAGE_CHARS = 2000

/** Checks and trims the conversation sent by the app. Null when unusable. */
export function cleanMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_MESSAGES) return null
  const out: ChatMessage[] = []
  for (const m of input) {
    if (!m || typeof m !== 'object') return null
    const { role, content } = m as { role?: unknown; content?: unknown }
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null
    const text = content.trim().slice(0, MAX_MESSAGE_CHARS)
    if (!text) return null
    out.push({ role, content: text })
  }
  if (out[out.length - 1].role !== 'user') return null
  return out
}

export function systemPrompt(shop: ShopContext, current: ProgrammeRules | null): string {
  const money = shop.currencySymbol || '£'
  return `You design loyalty programmes for small shops inside The Loyalty Loop app. You talk with the shop owner in plain, friendly British English, and you turn what they describe into a rules document the app runs exactly.

Shop: ${shop.name ? `"${shop.name}"` : 'not named yet'}${shop.category ? `, ${shop.category}` : ''}. Money is ${money}; every amount in the rules is in pence (${money}1 = 100).

HOW THE APP WORKS
- At the till, staff scan the customer's code and type the bill amount. Every rule below runs on that purchase.
- Customers collect one kind of points. You choose its name (unit), e.g. points, beans, stars, stamps.
- Points sit in a wallet. They are spent on rewards from a menu (points_cost), or turned into money off at the till (cash_value), or both.
- Rewards can also be handed out automatically by milestones.
- Member levels unlock by visits or by spend in the last 12 months, and can multiply points and list perks staff honour.

BUILDING BLOCKS (the only things the app can run)
{
  "version": 1,
  "unit": {"one": "point", "many": "points"},          // 1-20 chars each
  "earn": [                                             // up to 12 rules; each has a label (1-80 chars) and EXACTLY ONE of:
    {"label": "...", "per_pound": 1},                   //   points per ${money}1 of the bill (decimals ok, max 1000; rounded down)
    {"label": "...", "per_visit": 5},                   //   flat points per purchase (whole number)
    {"label": "...", "multiplier": 2}                   //   multiplies the visit's total (1 < x <= 10); best multiplier wins, they never stack
    // optional "when": {"days":[0-6, Sunday=0], "from":"HH:MM", "to":"HH:MM" (shop time, may wrap midnight),
    //   "min_spend_pence": n, "every_nth_visit": n (>=2), "first_visit": true, "levels": ["level-key"],
    //   "start_date":"YYYY-MM-DD", "end_date":"YYYY-MM-DD"}  - all conditions must hold
  ],
  "bonuses": {"signup": n, "birthday": n, "referral": n},   // optional whole numbers. birthday = first purchase in birthday month, once a year. referral = to the member who invited a friend who joins
  "cash_value": {"points": 3, "pence": 100, "max_pence_per_visit": 1000},  // optional: "3 points = ${money}1 off", taken off in whole steps by staff
  "rewards": [                                          // up to 12. key: lower-case a-z 0-9 dashes, unique
    {"key": "coffee", "title": "Free coffee", "description": "...", "points_cost": 10, "discount_pence": 300}
    // points_cost: customers can swap points for it. Omit points_cost only if a milestone gives it.
    // optional value staff take off: discount_pence OR discount_percent (1-100), not both.
  ],
  "milestones": [                                       // optional, up to 8; EXACTLY ONE of every_visits / at_lifetime_spend_pence
    {"label": "Every 10th visit", "reward": "coffee", "every_visits": 10},
    {"label": "Spend ${money}100", "reward": "coffee", "at_lifetime_spend_pence": 10000}  // once per customer
  ],
  "levels": [                                           // optional, up to 6; all use the same measure
    {"key": "gold", "name": "Gold", "min_visits": 20, "multiplier": 2, "perks": ["10% off everything"]}
    // or "min_spend_12m_pence": 50000 instead of min_visits. perks are text staff honour (up to 6, 80 chars).
  ],
  "expiry": {"inactive_months": 12},                    // optional: wallet empties after n months with no visit
  "caps": {"max_points_per_visit": n, "max_points_per_day": n},  // optional
  "summary": "1-3 sentences a customer would read"      // required, max 600 chars
}
Every programme needs at least one way to earn and at least one way to use points (a reward, cash_value or levels). Omit optional fields instead of sending null or empty objects. No other fields are allowed.

WHAT YOU DO
1. Understand the owner's idea. If something essential is missing, ask ONE short question at a time (and keep "rules" null). Do not ask about things you can sensibly default.
2. As soon as you can, build the full rules and explain them in a few short lines in "reply", in the owner's words, with real numbers ("Spend ${money}10, get 10 points; 3 points = ${money}1 off"). Then ask if they want to change anything.
3. When they ask for changes, send the complete updated rules each time.
4. If they ask for something these blocks cannot do (for example points for social media posts, per-product points without a till link, games, prize draws, or anything that needs information the till does not record), still build the closest working version, say plainly what is different, and list it in "unsupported". Never pretend the app does something it does not.
5. "Spend ${money}X, get a reward" means every time, unless the owner clearly says once: earn per_pound and give the reward a points_cost (1 point per ${money}1 and a ${money}10 coffee costs 10 points). Pick per_pound so the cost is a whole number (${money}10.50 → 2 points per ${money}1, reward costs 21). Use at_lifetime_spend_pence only for a one-off thank-you the owner asked for, and tell them it happens once per customer.
6. If customers collect points, they must be able to spend them: at least one reward with a points_cost, or cash_value. A programme whose only reward comes from milestones must not hand out points that do nothing.
7. Check the maths is sensible for a small shop (e.g. warn if rewards are very generous) but respect the owner's choice.

ANSWER FORMAT
Reply with ONE JSON object and nothing else:
{"reply": "what you say to the owner (plain text, no markdown headings, short)", "rules": {...} or null, "unsupported": [{"request": "what they asked for", "closest": "what you built instead"}]}
${current ? `\nTHE SHOP'S CURRENT RULES (change these when asked, keep everything else):\n${JSON.stringify(current)}` : ''}`
}

/** Reads the model's text into an answer. Throws when it is not the agreed JSON. */
export function parseAnswer(raw: string): { reply: string; rules: unknown; unsupported: Unsupported[] } {
  let text = raw.trim()
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/)
  if (fence) text = fence[1].trim()
  const parsed = JSON.parse(text) as Record<string, unknown>
  if (!parsed || typeof parsed !== 'object' || typeof parsed.reply !== 'string' || !parsed.reply.trim()) {
    throw new Error('answer has no reply')
  }
  const unsupported: Unsupported[] = []
  if (Array.isArray(parsed.unsupported)) {
    for (const u of parsed.unsupported.slice(0, 10)) {
      if (u && typeof u === 'object' && typeof (u as Unsupported).request === 'string' && (u as Unsupported).request.trim()) {
        unsupported.push({
          request: (u as Unsupported).request.trim().slice(0, 1000),
          closest: typeof (u as Unsupported).closest === 'string' ? (u as Unsupported).closest.trim().slice(0, 1000) : '',
        })
      }
    }
  }
  return { reply: parsed.reply.trim().slice(0, 4000), rules: parsed.rules ?? null, unsupported }
}

/**
 * Design mistakes the rules format allows but owners never want. Only the AI
 * designer applies these; saved programmes are still read with validateRules alone.
 */
export function designProblems(rules: ProgrammeRules): string[] {
  const problems: string[] = []
  const b = rules.bonuses
  const collects = rules.earn.some((r) => r.per_pound !== undefined || r.per_visit !== undefined) ||
    Boolean(b && ((b.signup ?? 0) > 0 || (b.birthday ?? 0) > 0 || (b.referral ?? 0) > 0))
  const canSpend = rules.rewards.some((r) => r.points_cost !== undefined) || Boolean(rules.cash_value)
  if (collects && !canSpend) {
    problems.push('Customers collect points but can never spend them: give at least one reward a points_cost (for "spend X, get Y" make it repeat with points, not a once-only at_lifetime_spend_pence milestone), or add cash_value.')
  }
  return problems
}

export type ModelCall = (messages: { role: 'system' | 'user' | 'assistant'; content: string }[]) => Promise<string>

/**
 * One owner turn: ask the model, check its rules, and if they are invalid give
 * it the errors once to fix them. Never returns invalid rules.
 */
export async function designTurn(
  call: ModelCall,
  shop: ShopContext,
  current: ProgrammeRules | null,
  messages: ChatMessage[],
): Promise<DesignAnswer> {
  const convo: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt(shop, current) },
    ...messages,
  ]
  let lastReply = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = await call(convo)
    let answer
    try {
      answer = parseAnswer(raw)
    } catch {
      convo.push({ role: 'assistant', content: raw.slice(0, 4000) })
      convo.push({ role: 'user', content: 'That was not the JSON object I need. Answer again with only {"reply", "rules", "unsupported"}.' })
      continue
    }
    lastReply = answer.reply
    if (answer.rules === null) return { reply: answer.reply, rules: null, unsupported: answer.unsupported }
    const check = validateRules(answer.rules)
    if (check.ok && designProblems(check.rules).length) {
      convo.push({ role: 'assistant', content: raw.slice(0, 8000) })
      convo.push({ role: 'user', content: `(Automatic check, not the owner.) ${designProblems(check.rules).join(' ')} Fix it and answer again with the full JSON.` })
      continue
    }
    if (check.ok) return { reply: answer.reply, rules: check.rules, unsupported: answer.unsupported }
    convo.push({ role: 'assistant', content: raw.slice(0, 8000) })
    convo.push({
      role: 'user',
      content: `(Automatic check, not the owner.) The rules are not valid: ${check.errors.slice(0, 12).join('; ')}. Fix them and answer again with the full JSON.`,
    })
  }
  return {
    reply: lastReply
      ? `${lastReply}\n\n(I couldn't turn that into working rules this time. Could you say it a slightly different way?)`
      : "Sorry, I couldn't put that together this time. Could you describe it again in a sentence or two?",
    rules: null,
    unsupported: [],
  }
}
