export function AuthLogo({ className }: { className?: string }) {
  const bigPetal =
    'M60,12 C77,14 90,28 88,45 C87,55 78,60 68,58 C72,48 68,36 60,30 C55,26 56,18 60,12 Z'
  const smallPetal =
    'M60,26 C70,27 78,35 76,44 C75,50 69,53 63,51 C66,45 63,38 58,35 C55,33 56,29 60,26 Z'

  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* three green blades + one rust blade, 90deg apart */}
      <path d={bigPetal} fill="#6C8B4D" transform="rotate(0 60 60)" />
      <path d={bigPetal} fill="#6C8B4D" transform="rotate(90 60 60)" />
      <path d={bigPetal} fill="#6C8B4D" transform="rotate(270 60 60)" />
      <path d={bigPetal} fill="#9C4A24" transform="rotate(180 60 60)" />

      {/* four smaller orange petals tucked in the diagonal seams */}
      <path d={smallPetal} fill="#D08A3E" transform="rotate(45 60 60)" />
      <path d={smallPetal} fill="#D08A3E" transform="rotate(135 60 60)" />
      <path d={smallPetal} fill="#D08A3E" transform="rotate(225 60 60)" />
      <path d={smallPetal} fill="#D08A3E" transform="rotate(315 60 60)" />
    </svg>
  )
}
