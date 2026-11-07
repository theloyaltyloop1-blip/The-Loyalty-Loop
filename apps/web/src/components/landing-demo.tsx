import { useState, type CSSProperties } from 'react'
import { Check, Gift, RotateCcw } from 'lucide-react'
import { LoopMark } from '@/components/loop-mark'

// A small play-along demo for the landing page: the visitor plays the shop,
// taps "Add a stamp", and watches the customer's card fill up. Nothing is saved
// or sent anywhere; it is local state only. The shop is illustrative.
const GOAL = 5

export function LandingDemo() {
  const [stamps, setStamps] = useState(0)
  const [redeemed, setRedeemed] = useState(false)
  const ready = stamps >= GOAL
  const left = GOAL - stamps

  const addStamp = () => {
    if (ready) return
    setRedeemed(false)
    setStamps((s) => Math.min(GOAL, s + 1))
  }
  const redeem = () => {
    setStamps(0)
    setRedeemed(true)
  }
  const reset = () => {
    setStamps(0)
    setRedeemed(false)
  }

  const status = ready
    ? 'Reward ready. One free coffee.'
    : redeemed
      ? 'Reward redeemed. The card starts again.'
      : stamps === 0
        ? 'No stamps yet. Tap Add a stamp.'
        : `${stamps} of ${GOAL} stamps. ${left} to go.`

  return (
    <section id="try-it" className="lp-wrap lp-demo" aria-labelledby="lp-demo-title">
      <div className="lp-demo-copy" data-reveal>
        <p className="lp-kicker">Try it</p>
        <h2 id="lp-demo-title">Five taps to <em>a free coffee.</em></h2>
        <p>Each tap is a visit recorded at the till. Watch the card fill up, then claim the reward.</p>
      </div>

      <div className="lp-demo-stage" data-reveal style={{ '--d': 2 } as CSSProperties}>
        <div className="lp-demo-till">
          <p className="lp-record-label">Shop’s phone</p>
          <div className="lp-record-code"><span>Customer code</span><strong>K7P 2QD</strong></div>
          {ready ? (
            <button type="button" className="lp-demo-btn" onClick={redeem}>
              <Gift size={17} aria-hidden="true" /> Redeem reward
            </button>
          ) : (
            <button type="button" className="lp-demo-btn" onClick={addStamp}>
              Add a stamp
            </button>
          )}
          <button type="button" className="lp-demo-reset" onClick={reset} disabled={stamps === 0 && !redeemed}>
            <RotateCcw size={14} aria-hidden="true" /> Start again
          </button>
        </div>

        <div className={`lp-demo-card${ready ? ' is-ready' : ''}`}>
          <div className="lp-card-top">
            <span className="lp-card-shop">Marlow Street Coffee</span>
            <LoopMark className="h-6 w-6" />
          </div>
          <p className="lp-demo-title">{ready ? 'On the house.' : 'The usual, please.'}</p>
          <div className="lp-demo-stamps" aria-hidden="true">
            {Array.from({ length: GOAL }, (_, i) => (
              <span key={i} className={i < stamps ? 'lp-stamp is-filled' : 'lp-stamp'}>
                {i < stamps ? <Check size={18} strokeWidth={2.5} /> : null}
              </span>
            ))}
          </div>
          <p className="lp-demo-status" role="status" aria-live="polite">{status}</p>
        </div>
      </div>
    </section>
  )
}
