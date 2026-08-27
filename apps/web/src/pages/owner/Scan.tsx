import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { BrowserQRCodeReader } from '@zxing/browser'
import { Camera, CameraOff, Check, Gift, ScanLine, X } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { OwnerLayout } from '@/components/owner-layout'
import { BarePageSkeleton } from '@/components/page-skeleton'
import { useOwner } from '@/lib/owner-context'
import {
  awardProgress,
  sendUserPush,
  updateWalletPass,
  findRewardByCode,
  findRewardByToken,
  lookupUserByStampCode,
  fetchScannedMemberDetails,
  redeemReward,
  sendVisitThankYou,
  type RewardLookup,
  type ScannedMemberDetails,
} from '@/lib/businesses'

const UNIT_LABEL: Record<string, string> = {
  stamp_card: 'stamp',
  points: 'point',
  tiered: 'visit',
}

type ScanMode = 'award' | 'redeem'

function CameraScanner({ onResult, active }: { onResult: (value: string) => void; active: boolean }) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const resultRef = React.useRef(onResult)
  const [error, setError] = React.useState<string | null>(null)
  const [running, setRunning] = React.useState(false)

  React.useEffect(() => { resultRef.current = onResult }, [onResult])

  React.useEffect(() => {
    if (!active || !videoRef.current) return
    let cancelled = false
    let found = false
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
            if (!result || found || cancelled) return
            found = true
            controls?.stop()
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
    <div className="rounded-xl overflow-hidden bg-black relative mb-4 aspect-square max-w-xs mx-auto">
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

function AwardPanel({ businessId, unit }: { businessId: string; unit: string }) {
  const [cameraOn, setCameraOn] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [match, setMatch] = React.useState<ScannedMemberDetails | null>(null)
  const [matchedUserId, setMatchedUserId] = React.useState<string | null>(null)
  const [amount, setAmount] = React.useState(1)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  function reset() {
    setCode('')
    setMatch(null)
    setMatchedUserId(null)
    setError(null)
  }

  async function handleLookup() {
    if (!code.trim()) return
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
      const details = await fetchScannedMemberDetails(businessId, result.id)
      setMatch(details)
      setMatchedUserId(result.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleQrResult(value: string) {
    setCameraOn(false)
    const m = value.match(/^loyaltyloop:customer:(.+)$/)
    if (!m) {
      setError('That QR code is not a Loyalty Loop customer card.')
      return
    }
    setError(null)
    setSuccess(null)
    try {
      setMatch(await fetchScannedMemberDetails(businessId, m[1]))
      setMatchedUserId(m[1])
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load customer details') }
  }

  async function handleAward() {
    if (!matchedUserId) return
    setBusy(true)
    setError(null)
    try {
      await awardProgress(businessId, matchedUserId, amount)
      void sendVisitThankYou(businessId, matchedUserId, amount)
      void sendUserPush(businessId, matchedUserId)
      void updateWalletPass(businessId, matchedUserId)
      setSuccess(`Awarded ${amount} ${unit}${amount === 1 ? '' : 's'}.`)
      reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not award — is this customer a member of your shop?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex flex-col gap-4 lg:pr-[21rem]">
      <div className="flex items-center justify-center">
        <button data-press-feedback
          onClick={() => setCameraOn((c) => !c)}
          className="flex items-center gap-2 rounded-full border border-black/15 px-4 h-10 font-semibold text-sm text-foreground"
        >
          {cameraOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          {cameraOn ? 'Stop camera' : 'Scan customer QR'}
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
        <aside className="rounded-2xl border border-black/5 bg-black/[0.045] px-5 py-5 lg:absolute lg:right-0 lg:top-0 lg:w-[19rem]">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/45">Member information</p>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {match.first_name || match.last_name ? `${match.first_name ?? ''} ${match.last_name ?? ''}`.trim() : 'Customer found'}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-sm text-foreground/70">
            <span>Email: {match.email ?? 'Not available'}</span><span>Joined: {new Date(match.joined_at).toLocaleDateString()}</span>
            <span>Last visit: {match.last_activity_at ? new Date(match.last_activity_at).toLocaleDateString() : 'Not yet'}</span><span>{match.stamp_count} stamps · {match.points_balance} points · {match.visit_count} visits</span>
          </div>
        </aside>
      )}

      {matchedUserId && (
        <>
          <div>
            <p className="text-sm font-semibold text-foreground mb-1.5">Amount to award</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                className="h-12 w-24 rounded-xl border border-black/10 bg-white px-4 font-bold outline-none focus:border-primary"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Math.min(50, Number(e.target.value))))}
              />
              <span className="text-sm text-foreground/50">{unit}{amount === 1 ? '' : 's'}</span>
            </div>
          </div>
          <button data-press-feedback
            onClick={handleAward}
            disabled={busy}
            className="h-12 rounded-full bg-primary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> {busy ? 'Awarding…' : `Award ${amount} ${unit}${amount === 1 ? '' : 's'}`}
          </button>
          <button data-press-feedback onClick={reset} className="text-sm font-semibold text-foreground/50 self-center">
            Cancel
          </button>
        </>
      )}

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      {success && <p className="text-sm text-fun-green font-semibold text-center">{success}</p>}
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
  const loyaltyType = isOwner ? business!.loyalty_type : activeStaff?.business.loyalty_type
  const unit = UNIT_LABEL[loyaltyType ?? 'stamp_card'] ?? 'stamp'
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
        <ScanLine className="h-7 w-7 text-primary" /> Award & redeem
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
                      {key === 'award' ? `Add ${unit}` : 'Redeem reward'}
                    </button>
                  ))}
              </div>

              <div className="rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
                {mode === 'award' && canScan && <AwardPanel businessId={activeBusinessId} unit={unit} />}
                {mode === 'redeem' && canRedeem && <RedeemPanel businessId={activeBusinessId} />}
              </div>
            </>
          )}
        </div>
      )}
    </OwnerLayout>
  )
}
