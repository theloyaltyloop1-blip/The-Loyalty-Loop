import loopMark from '@/assets/loyalty-loop-mark-96.webp'

// 96px WebP (~3 KB) covers every on-screen size up to 48px at 2x. Fixed
// width/height reserve the box before the file arrives, so layouts don't jump.
export function LoopMark({ className, alt = '' }: { className?: string; alt?: string }) {
  return <img src={loopMark} alt={alt} width={96} height={96} decoding="async" className={className} />
}
