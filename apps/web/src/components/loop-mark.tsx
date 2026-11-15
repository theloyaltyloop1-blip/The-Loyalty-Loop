import loyaltyLoopLogo from '@/assets/loyalty-loop-mark.svg'

export function LoopMark({ className }: { className?: string }) {
  return <img src={loyaltyLoopLogo} alt="" className={className} />
}
