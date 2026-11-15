/** Whirl the mascot. Light and dark artwork are both rendered; CSS shows the one that matches `html.dark`. */
export type WhirlPose = 'wave' | 'stamp' | 'celebrate' | 'sleepy' | 'think' | 'thumbs'

export function Whirl({ pose, className = '' }: { pose: WhirlPose; className?: string }) {
  return (
    <>
      <img src={`/mascot/whirl-${pose}.svg`} alt="" aria-hidden="true" className={`whirl-light ${className}`} />
      <img src={`/mascot/dark/whirl-${pose}.svg`} alt="" aria-hidden="true" className={`whirl-dark ${className}`} />
    </>
  )
}
