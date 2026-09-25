import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { BrowserQRCodeReader } from '@zxing/browser'
import { Camera, CameraOff, Check, Gift, ScanLine, X } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { BarePageSkeleton } from '@/components/page-skeleton'
import { useOwner } from '@/lib/owner-context'
import {
  sendUserPush,
  updateWalletPass,
  findRewardByCode,
  findRewardByToken,
  lookupUserByStampCode,
  fetchScannedMemberDetails,
  redeemReward,
  fetchSpendSummary,
  recordManualSpend,
  undoManualSpend,
  fetchMyRecentSpend,
  spendErrorMessage,
  formatPounds,
  type RewardLookup,
  type ScannedMemberDetails,
  type SpendSummary,
  type RecentSpend,
} from '@/lib/businesses'

type ScanMode = 'award' | 'redeem'

function CameraScanner({ onResult, active, scanCycle = 0 }: { onResult: (value: string) => void; active: boolean; scanCycle?: number }) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const resultRef = React.useRef(onResult)
  const foundRef = React.useRef(false)
  const [error, setError] = React.useState<string | null>(null)
  const [running, setRunning] = React.useState(false)

  React.useEffect(() => { resultRef.current = onResult }, [onResult])
  React.useEffect(() => { foundRef.current = false }, [scanCycle])

  React.useEffect(() => {
    if (!active || !videoRef.current) return
    let cancelled = false
    let controls: { stop: () => void } | undefined
    const reader = new BrowserQRCodeReader()
    setError(null)
    setRunning(false)

    async function start() {
      try {
        controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current!,
          (result) => {
            if (!result || foundRef.current || cancelled) return
            // Keep the camera warm after a match. Awarding re-arms it for the
            // next person without asking the device to start the camera again.
            foundRef.current = true
            resultRef.current(result.getText())
          },
        )
        if (cancelled) {
          controls.stop()
          return
        }
        setRunning(true)
      } catch {
        if (!cancelled) setError('Camera access was blocked or unavailable. Check your browser permission, then use the manual code below if needed.')
      }
    }
    start()

    return () => {
      cancelled = true
      controls?.stop()
      setRunning(false)
    }
  }, [active])

  if (!active) return null

  return (
    <div className="relative mb-4 w-full overflow-hidden rounded-2xl bg-black aspect-[4/3]">
      <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
      {!running && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-sm bg-black/40">
          Starting camera…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-sm bg-black/70 p-4 text-center">
          {error}
        </div>
      )}
    </div>
  )
}

/** Records a purchase in £ for the scanned customer (ARCH_PLAN.md §4.10–4.11).
 * The server enforces the shop's cap, the linked-card payment question and
 * the daily limits; clientRef makes a retry after a dropped connection safe. */
function SpendPanel({ businessId, staffUserId }: { businessId: string; staffUserId: string }) {
  const [cameraOn, setCameraOn] = React.useState(true)
  const [scanCycle, setScanCycle] = React.useState(0)
  const [code, setCode] = React.useState('')
  const [match, setMatch] = React.useState<ScannedMemberDetails | null>(null)
  const [matchedUserId, setMatchedUserId] = React.useState<string | null>(null)
  const [summary, setSummary] = React.useState<SpendSummary | null>(null)
  const [amount, setAmount] = React.useState('')
  const [askPayment, setAskPayment] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [recent, setRecent] = React.useState<RecentSpend[]>([])
  const [now, setNow] = React.useState(Date.now())
  const clientRef = React.useRef<string | null>(null)

  const loadRecent = React.useCallback(async () => {
    try {
      setRecent(await fetchMyRecentSpend(businessId, staffUserId))
    } catch {
      setRecent([])
    }
  }, [businessId, staffUserId])
  React.useEffect(() => { void loadRecent() }, [loadRecent])
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(timer)
  }, [])

  const cleaned = amount.replace(/[£,\s]/g, '')
  const amountPence = /^\d+(\.\d{1,2})?$/.test(cleaned) ? Math.round(Number(cleaned) * 100) : 0
  const cap = summary?.manualMaxPence ?? 20000

  function reset() {
    setCode('')
    setMatch(null)
    setMatchedUserId(null)
    setSummary(null)
    setAmount('')
    setAskPayment(false)
    setError(null)
    clientRef.current = null
  }

  async function identify(userId: string) {
    const details = await fetchScannedMemberDetails(businessId, userId)
    if (!details) {
      setMatch(null)
      setMatchedUserId(null)
      setError('This customer has not joined this shop yet.')
      return false
    }
    setMatch(details)
    setMatchedUserId(userId)
    setSummary(await fetchSpendSummary(businessId, userId))
    return true
  }

  async function handleLookup() {
    if (!code.trim()) return
    setCameraOn(false)
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await lookupUserByStampCode(code)
      if (!result) {
        setError('No customer found with that code.')
        setMatch(null)
        setMatchedUserId(null)
        return
      }
      await identify(result.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleQrResult(value: string) {
    const m = value.match(/^loyaltyloop:customer:(.+)$/)
    if (!m) {
      setError('That QR code is not a Loyalty Loop customer card.')
      setScanCycle((cycle) => cycle + 1)
      return
    }
    setError(null)
    setSuccess(null)
    setBusy(true)
    try {
      if (await identify(m[1])) setCameraOn(false)
      else setScanCycle((cycle) => cycle + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load customer details')
      setScanCycle((cycle) => cycle + 1)
    } finally {
      setBusy(false)
    }
  }

  async function handleAdd(paymentMethod?: 'cash' | 'unlinked_card') {
    if (!matchedUserId || amountPence < 1) return
    if (amountPence > cap) {
      setError(`Each entry can be at most ${formatPounds(cap)}.`)
      return
    }
    if (summary?.linked && !paymentMethod) {
      setAskPayment(true)
      return
    }
    setAskPayment(false)
    const name = match?.first_name || 'this customer'
    const big = amountPence * 2 >= cap
    if (!window.confirm(big
      ? `${formatPounds(amountPence)} is a large amount for one purchase. Add it for ${name}?`
      : `Add ${formatPounds(amountPence)} for ${name}?`)) return
    clientRef.current = clientRef.current ?? crypto.randomUUID()
    setBusy(true)
    setError(null)
    try {
      const result = await recordManualSpend(businessId, matchedUserId, amountPence, paymentMethod ?? null, clientRef.current)
      clientRef.current = null
      const left = Math.max(0, (result.thresholdPence ?? 0) - result.progressPence)
      setSuccess(result.rewardsEarned
        ? `${formatPounds(amountPence)} added. ${name} earned ${result.rewardsEarned === 1 ? 'a reward' : `${result.rewardsEarned} rewards`}!`
        : `${formatPounds(amountPence)} added. ${name} is ${formatPounds(left)} from ${result.nextRewardTitle ?? 'their next reward'}.`)
      void sendUserPush(businessId, matchedUserId)
      void updateWalletPass(businessId, matchedUserId)
      void loadRecent()
      reset()
      setCameraOn(true)
      setScanCycle((cycle) => cycle + 1)
    } catch (e) {
      const message = spendErrorMessage(e)
      // A server refusal is final, so the next attempt is a new entry. Any other
      // failure (e.g. the connection dropped) keeps clientRef, so retrying can
      // never credit the purchase twice.
      const raw = (e as { message?: string } | null)?.message ?? ''
      if (/amount_out_of_range|not_a_member|shop_not_spend_based|linked_customer_payment_method_required|manual_daily_limit_reached|manual_too_soon|not_allowed|invalid_/.test(raw)) {
        clientRef.current = null
      }
      setError(message)
      if (matchedUserId) void fetchSpendSummary(businessId, matchedUserId).then(setSummary).catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  async function handleUndo(entry: RecentSpend) {
    if (!window.confirm(`Undo ${formatPounds(entry.value)}? This takes it back off the customer's progress.`)) return
    try {
      await undoManualSpend(entry.id, 'Undone by staff')
      setSuccess(`${formatPounds(entry.value)} undone.`)
    } catch (e) {
      setError(spendErrorMessage(e))
    }
    void loadRecent()
  }

  return (
    <div className="relative flex flex-col gap-4">
      <div className="flex items-center justify-center">
        <button data-press-feedback
          onClick={() => setCameraOn((c) => !c)}
          className="flex items-center gap-2 rounded-full border border-black/15 px-4 h-10 font-semibold text-sm text-foreground"
        >
          {cameraOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          {cameraOn ? 'Camera ready' : 'Start camera'}
        </button>
      </div>

      <CameraScanner active={cameraOn} onResult={handleQrResult} scanCycle={scanCycle} />

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-black/10" />
        <span className="text-xs font-bold uppercase tracking-wide text-foreground/30">manual code instead</span>
        <div className="flex-1 h-px bg-black/10" />
      </div>

      <div className="flex items-center gap-2">
        <input
          className="h-12 flex-1 rounded-xl border border-black/10 bg-white px-4 font-mono font-bold tracking-widest uppercase outline-none focus:border-primary"
          placeholder="Customer's manual code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\s+/g, '').toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
        />
        <button data-press-feedback
          onClick={handleLookup}
          disabled={busy || !code.trim()}
          className="h-12 rounded-xl bg-foreground text-white font-bold px-5 disabled:opacity-40"
        >
          Find
        </button>
      </div>

      {match && (
        <aside className="rounded-2xl border border-black/5 bg-black/[0.045] px-5 py-5 lg:ml-auto lg:w-[19rem]">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/45">Member information</p>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {match.first_name || match.last_name ? `${match.first_name ?? ''} ${match.last_name ?? ''}`.trim() : 'Customer found'}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-sm text-foreground/70">
            <span>Email: {match.email ?? 'Not available'}</span><span>Joined: {new Date(match.joined_at).toLocaleDateString()}</span>
            <span>Last visit: {match.last_activity_at ? new Date(match.last_activity_at).toLocaleDateString() : 'Not yet'}</span>
            <span>
              {summary?.thresholdPence
                ? `${formatPounds(Math.max(0, summary.progressPence ?? 0))} of ${formatPounds(summary.thresholdPence)} towards ${summary.nextRewardTitle ?? 'the next reward'}`
                : 'Loading progress…'}
              {summary?.redemptionBlocked ? ' · reward paused' : ''}
            </span>
          </div>
        </aside>
      )}

      {matchedUserId && (
        <>
          <div>
            <p className="text-sm font-semibold text-foreground mb-1.5">Amount spent</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground/60">£</span>
              <input
                inputMode="decimal"
                className="h-12 w-36 rounded-xl border border-black/10 bg-white px-4 font-bold outline-none focus:border-primary"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <span className="text-sm text-foreground/50">up to {formatPounds(cap)} per entry</span>
            </div>
          </div>
          {askPayment ? (
            <div className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col gap-2">
              <p className="font-semibold text-foreground">This customer has a linked card</p>
              <p className="text-sm text-foreground/60">If they paid with it, their reward updates automatically, so there's nothing to do. How did they pay?</p>
              <button data-press-feedback onClick={() => handleAdd('cash')} disabled={busy} className="h-11 rounded-full bg-primary text-white font-bold disabled:opacity-50">Cash</button>
              <button data-press-feedback onClick={() => handleAdd('unlinked_card')} disabled={busy} className="h-11 rounded-full bg-primary text-white font-bold disabled:opacity-50">A different card</button>
              <button data-press-feedback onClick={() => setAskPayment(false)} className="h-11 rounded-full border border-black/15 font-bold text-foreground">They used their linked card</button>
              {summary && summary.manualToday > 0 && (
                <p className="text-xs text-foreground/50 text-center">{summary.manualToday} of 3 manual entries used today for this customer.</p>
              )}
            </div>
          ) : (
            <button data-press-feedback
              onClick={() => handleAdd()}
              disabled={busy || amountPence < 1}
              className="h-12 rounded-full bg-primary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> {busy ? 'Adding…' : amountPence ? `Add ${formatPounds(amountPence)}` : 'Type the amount'}
            </button>
          )}
          <button data-press-feedback onClick={reset} className="text-sm font-semibold text-foreground/50 self-center">
            Cancel
          </button>
        </>
      )}

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      {success && <p className="text-sm text-fun-green font-semibold text-center">{success}</p>}

      {recent.length > 0 && (
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-foreground/45 mb-2">Your recent entries</p>
          {recent.map((entry) => {
            const minutesLeft = Math.max(0, Math.ceil((10 * 60 * 1000 - (now - new Date(entry.created_at).getTime())) / 60000))
            return (
              <div key={entry.id} className="flex items-center gap-3 py-2 border-t border-black/5 first:border-t-0">
                <span className="font-bold text-foreground w-20">{formatPounds(entry.value)}</span>
                <span className="flex-1 text-sm text-foreground/50">
                  {new Date(entry.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {minutesLeft > 0 && (
                  <button data-press-feedback onClick={() => handleUndo(entry)} className="text-sm font-bold text-primary">
                    Undo · {minutesLeft} min
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RedeemPanel({ businessId }: { businessId: string }) {
  const [cameraOn, setCameraOn] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [reward, setReward] = React.useState<RewardLookup | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  async function handleLookup() {
    if (!code.trim()) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await findRewardByCode(businessId, code)
      if (!result) {
        setError('No reward found with that code at this shop.')
        setReward(null)
        return
      }
      setReward(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleQrResult(value: string) {
    setCameraOn(false)
    const m = value.match(/^loyaltyloop:reward:(.+)$/)
    if (!m) {
      setError('That QR code is not a Loyalty Loop reward.')
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await findRewardByToken(businessId, m[1])
      if (!result) {
        setError('That reward was not found at this shop.')
        return
      }
      setReward(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleRedeem() {
    if (!reward) return
    setBusy(true)
    setError(null)
    try {
      await redeemReward(reward.id)
      void sendUserPush(businessId, reward.user_id)
      void updateWalletPass(businessId, reward.user_id)
      setSuccess(`Redeemed: ${reward.title}`)
      setReward(null)
      setCode('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not redeem this reward.')
    } finally {
      setBusy(false)
    }
  }

  const alreadyRedeemed = Boolean(reward?.redeemed_at)
  const expired = Boolean(reward?.expires_at && new Date(reward.expires_at) < new Date())

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center">
        <button data-press-feedback
          onClick={() => setCameraOn((c) => !c)}
          className="flex items-center gap-2 rounded-full border border-black/15 px-4 h-10 font-semibold text-sm text-foreground"
        >
          {cameraOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          {cameraOn ? 'Stop camera' : 'Scan reward QR'}
        </button>
      </div>

      <CameraScanner active={cameraOn} onResult={handleQrResult} />

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-black/10" />
        <span className="text-xs font-bold uppercase tracking-wide text-foreground/30">or manual code</span>
        <div className="flex-1 h-px bg-black/10" />
      </div>

      <div className="flex items-center gap-2">
        <input
          className="h-12 flex-1 rounded-xl border border-black/10 bg-white px-4 font-mono font-bold tracking-widest uppercase outline-none focus:border-primary"
          placeholder="Reward's short code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
        />
        <button data-press-feedback
          onClick={handleLookup}
          disabled={busy || !code.trim()}
          className="h-12 rounded-xl bg-foreground text-white font-bold px-5 disabled:opacity-40"
        >
          Find
        </button>
      </div>

      {reward && (
        <div className="rounded-xl bg-black/5 px-4 py-3 flex items-center gap-3">
          <Gift className="h-5 w-5 text-[#8E5FC2] shrink-0" />
          <div>
            <p className="font-semibold text-foreground">{reward.title}</p>
            {alreadyRedeemed && <p className="text-xs text-red-600 font-semibold">Already redeemed</p>}
            {!alreadyRedeemed && expired && <p className="text-xs text-red-600 font-semibold">Expired</p>}
          </div>
        </div>
      )}

      {reward && !alreadyRedeemed && !expired && (
        <button data-press-feedback
          onClick={handleRedeem}
          disabled={busy}
          className="h-12 rounded-full bg-primary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> {busy ? 'Redeeming…' : 'Redeem reward'}
        </button>
      )}

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      {success && <p className="text-sm text-fun-green font-semibold text-center">{success}</p>}
    </div>
  )
}

export function OwnerScan() {
  const { session, loading } = useAuth()
  const { business, staffBusinesses } = useOwner()
  const [mode, setMode] = React.useState<ScanMode>('award')
  const [staffBizId, setStaffBizId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!business && staffBusinesses.length > 0 && !staffBizId) {
      setStaffBizId(staffBusinesses[0].business_id)
    }
  }, [business, staffBusinesses, staffBizId])

  const isOwner = Boolean(business)
  const activeStaff = !isOwner ? staffBusinesses.find((s) => s.business_id === staffBizId) ?? staffBusinesses[0] : null
  const activeBusinessId = isOwner ? business!.id : activeStaff?.business_id
  const canScan = isOwner || Boolean(activeStaff?.can_scan_stamps)
  const canRedeem = isOwner || Boolean(activeStaff?.can_redeem_rewards)

  React.useEffect(() => {
    if (mode === 'award' && !canScan && canRedeem) setMode('redeem')
    else if (mode === 'redeem' && !canRedeem && canScan) setMode('award')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canScan, canRedeem])

  if (loading) return <BarePageSkeleton />
  if (!session) return <Navigate to="/login" replace />

  return (
    <OwnerLayout>
      <p className="text-xs font-extrabold uppercase tracking-wide text-foreground/40 mb-1">Scan</p>
      <h1 className="text-3xl font-display font-extrabold text-foreground mb-6 flex items-center gap-3">
        <ScanLine className="h-7 w-7 text-primary" /> Purchases & rewards
      </h1>

      {!activeBusinessId ? (
        <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-10 text-center">
          <p className="text-foreground/50">
            {isOwner ? 'Set up a shop first.' : "You're not an active staff member at any shop yet."}
          </p>
        </div>
      ) : (
        <div className="max-w-md">
          {!isOwner && staffBusinesses.length > 1 && (
            <select
              className="h-11 w-full rounded-xl border border-black/10 bg-white px-4 mb-4 font-semibold text-foreground outline-none focus:border-primary"
              value={activeBusinessId}
              onChange={(e) => setStaffBizId(e.target.value)}
            >
              {staffBusinesses.map((s) => (
                <option key={s.business_id} value={s.business_id}>
                  {s.business.name}
                </option>
              ))}
            </select>
          )}

          {!canScan && !canRedeem ? (
            <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-8 text-center">
              <p className="text-foreground/50">You don't have permission to scan or redeem at this shop yet.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-1 bg-card rounded-full p-1 mb-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                {(['award', 'redeem'] as const)
                  .filter((key) => (key === 'award' ? canScan : canRedeem))
                  .map((key) => (
                    <button data-press-feedback
                      key={key}
                      onClick={() => setMode(key)}
                      className={
                        'flex-1 h-10 rounded-full text-sm font-bold capitalize transition-colors duration-150 ease-out flex items-center justify-center gap-1.5 ' +
                        (mode === key ? 'bg-primary text-white' : 'text-foreground/50')
                      }
                    >
                      {key === 'award' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      {key === 'award' ? 'Add purchase' : 'Redeem reward'}
                    </button>
                  ))}
              </div>

              <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
                {mode === 'award' && canScan && session && <SpendPanel businessId={activeBusinessId} staffUserId={session.user.id} />}
                {mode === 'redeem' && canRedeem && <RedeemPanel businessId={activeBusinessId} />}
              </div>
            </>
          )}
        </div>
      )}
    </OwnerLayout>
  )
}
