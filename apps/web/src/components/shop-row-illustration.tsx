export function ShopRowIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 560 360" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* sky */}
      <path d="M20 220 Q280 140 540 220" stroke="#BFE3F0" strokeWidth="60" strokeLinecap="round" fill="none" />
      {/* clouds */}
      <g fill="#fff" stroke="#40281C" strokeWidth="3">
        <ellipse cx="120" cy="150" rx="34" ry="18" />
        <ellipse cx="150" cy="140" rx="24" ry="14" />
        <ellipse cx="380" cy="130" rx="30" ry="16" />
        <ellipse cx="410" cy="140" rx="20" ry="12" />
      </g>

      {/* coffee shop */}
      <g>
        <rect x="40" y="180" width="130" height="150" fill="#F3D9C4" stroke="#40281C" strokeWidth="4" />
        <polygon points="35,180 105,120 175,180" fill="#40281C" />
        <rect x="55" y="200" width="30" height="40" fill="#fff" stroke="#40281C" strokeWidth="3" />
        <rect x="125" y="200" width="30" height="40" fill="#fff" stroke="#40281C" strokeWidth="3" />
        <rect x="75" y="270" width="60" height="60" fill="#EE5A2C" stroke="#40281C" strokeWidth="4" />
        <rect x="40" y="250" width="130" height="20" fill="#EE5A2C" stroke="#40281C" strokeWidth="3" />
        <text x="105" y="264" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="sans-serif">
          COFFEE
        </text>
      </g>

      {/* green grocer */}
      <g>
        <rect x="175" y="165" width="150" height="165" fill="#E7C98A" stroke="#40281C" strokeWidth="4" />
        <polygon points="170,165 250,105 330,165" fill="#40281C" />
        <rect x="195" y="185" width="34" height="40" fill="#fff" stroke="#40281C" strokeWidth="3" />
        <rect x="270" y="185" width="34" height="40" fill="#fff" stroke="#40281C" strokeWidth="3" />
        <rect x="185" y="240" width="130" height="18" fill="#30A66F" stroke="#40281C" strokeWidth="3" />
        <text x="250" y="253" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="sans-serif">
          GREEN GROCER
        </text>
        <rect x="185" y="262" width="130" height="30" fill="#fff" stroke="#40281C" strokeWidth="3" />
        <circle cx="205" cy="277" r="7" fill="#EE5A2C" />
        <circle cx="225" cy="277" r="7" fill="#F6AF23" />
        <circle cx="245" cy="277" r="7" fill="#30A66F" />
        <circle cx="265" cy="277" r="7" fill="#EE5A2C" />
        <circle cx="285" cy="277" r="7" fill="#F6AF23" />
        <rect x="210" y="295" width="80" height="35" fill="#40281C" opacity="0.08" />
      </g>

      {/* barbershop */}
      <g>
        <rect x="325" y="185" width="140" height="145" fill="#E7CCE8" stroke="#40281C" strokeWidth="4" />
        <polygon points="320,185 395,125 470,185" fill="#40281C" />
        <rect x="345" y="205" width="30" height="40" fill="#fff" stroke="#40281C" strokeWidth="3" />
        <rect x="415" y="205" width="30" height="40" fill="#fff" stroke="#40281C" strokeWidth="3" />
        <rect x="335" y="255" width="120" height="18" fill="#9069D3" stroke="#40281C" strokeWidth="3" />
        <text x="395" y="268" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="sans-serif">
          BARBERY
        </text>
        <rect x="380" y="280" width="30" height="50" fill="#fff" stroke="#40281C" strokeWidth="3" />
      </g>

      {/* ground */}
      <rect x="20" y="330" width="520" height="10" fill="#40281C" opacity="0.15" />

      {/* dog */}
      <g stroke="#40281C" strokeWidth="3" fill="#fff">
        <ellipse cx="500" cy="325" rx="20" ry="12" />
        <circle cx="518" cy="316" r="9" />
        <path d="M508 310l-4-8" strokeLinecap="round" />
        <circle cx="521" cy="314" r="1.4" fill="#40281C" stroke="none" />
      </g>
    </svg>
  )
}
