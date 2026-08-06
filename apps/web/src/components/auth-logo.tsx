export function AuthLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <g stroke="#33421f" strokeWidth="1.5" strokeLinejoin="round">
        <path
          d="M60 14c14 0 16 16 8 26-6 7-16 8-22 4 2-16 4-26 14-30z"
          fill="#6C8B4D"
        />
        <path
          d="M106 60c0 14-16 16-26 8-7-6-8-16-4-22 16 2 26 4 30 14z"
          fill="#C97C3D"
        />
        <path
          d="M60 106c-14 0-16-16-8-26 6-7 16-8 22-4-2 16-4 26-14 30z"
          fill="#6C8B4D"
        />
        <path
          d="M14 60c0-14 16-16 26-8 7 6 8 16 4 22-16-2-26-4-30-14z"
          fill="#C97C3D"
        />
      </g>
    </svg>
  )
}
