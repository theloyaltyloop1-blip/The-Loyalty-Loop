import logo640Avif from '@/assets/loyalty-loop-logo-640.avif'
import logo640Webp from '@/assets/loyalty-loop-logo-640.webp'
import logo640Png from '@/assets/loyalty-loop-logo-640.png'
import logo96Avif from '@/assets/loyalty-loop-logo-96.avif'
import logo96Webp from '@/assets/loyalty-loop-logo-96.webp'
import logo96Png from '@/assets/loyalty-loop-logo-96.png'

/** Brand logo served as AVIF/WebP with PNG fallback; explicit dimensions prevent layout shift. */
export function BrandLogo({
  variant = 'mark',
  alt = '',
  className,
  priority = false,
}: {
  variant?: 'mark' | 'full'
  alt?: string
  className?: string
  priority?: boolean
}) {
  const full = variant === 'full'
  return (
    <picture className="contents">
      <source type="image/avif" srcSet={full ? logo640Avif : logo96Avif} />
      <source type="image/webp" srcSet={full ? logo640Webp : logo96Webp} />
      <img
        src={full ? logo640Png : logo96Png}
        alt={alt}
        width={full ? 640 : 32}
        height={full ? 397 : 32}
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        className={className}
      />
    </picture>
  )
}
