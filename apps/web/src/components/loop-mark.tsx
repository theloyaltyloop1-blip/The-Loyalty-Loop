export function LoopMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="37" height="37" rx="8" fill="#F0DCC0" stroke="#40281C" strokeWidth="3" />
      <g stroke="#40281C" strokeWidth="2" strokeLinecap="round">
        <circle cx="20" cy="20" r="3.2" fill="#EE5A2C" stroke="none" />
        <path d="M20 10v4" />
        <path d="M20 26v4" />
        <path d="M10 20h4" />
        <path d="M26 20h4" />
        <path d="M13.5 13.5l2.8 2.8" />
        <path d="M23.7 23.7l2.8 2.8" />
        <path d="M26.5 13.5l-2.8 2.8" />
        <path d="M16.3 23.7l-2.8 2.8" />
      </g>
    </svg>
  )
}
