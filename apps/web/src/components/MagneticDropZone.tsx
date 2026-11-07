import * as React from 'react'
import { ImageIcon, Loader2 } from 'lucide-react'

/**
 * A file drop area that reacts while a file is dragged over it: it lifts,
 * the dashed edge turns solid, and the icon is pulled towards the pointer
 * like a magnet. Dropping uploads straight away; clicking (or Enter/Space)
 * opens the file picker. Holds an image preview once one exists.
 */
export function MagneticDropZone({
  accept,
  currentUrl,
  uploading,
  onFile,
  onReject,
  hint = 'Drag an image here, or click to choose',
  className = 'h-32',
}: {
  /** Comma-separated MIME types, same format as <input accept>. */
  accept: string
  currentUrl: string | null
  uploading: boolean
  onFile: (file: File) => void
  onReject?: (message: string) => void
  hint?: string
  className?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const zoneRef = React.useRef<HTMLDivElement>(null)
  const depth = React.useRef(0)
  const [over, setOver] = React.useState(false)
  const [pull, setPull] = React.useState({ x: 0, y: 0 })
  const allowed = React.useMemo(() => accept.split(',').map((t) => t.trim()), [accept])

  function take(file: File | undefined) {
    if (!file || uploading) return
    if (!allowed.includes(file.type)) {
      onReject?.('That file type isn’t supported. Use a PNG, JPG, WebP or GIF image.')
      return
    }
    onFile(file)
  }

  function magnet(e: React.DragEvent | React.PointerEvent) {
    const box = zoneRef.current?.getBoundingClientRect()
    if (!box) return
    // Pull the icon up to 14px towards the pointer, easing off near the edge.
    const dx = (e.clientX - (box.left + box.width / 2)) / (box.width / 2)
    const dy = (e.clientY - (box.top + box.height / 2)) / (box.height / 2)
    setPull({ x: Math.max(-1, Math.min(1, dx)) * 14, y: Math.max(-1, Math.min(1, dy)) * 10 })
  }

  const showImage = currentUrl && !over && !uploading

  return (
    <>
      <div
        ref={zoneRef}
        role="button"
        tabIndex={0}
        aria-label={currentUrl ? 'Replace image. Drop a file or press Enter to choose one.' : 'Upload image. Drop a file or press Enter to choose one.'}
        aria-busy={uploading}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          depth.current += 1
          setOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = uploading ? 'none' : 'copy'
          magnet(e)
        }}
        onDragLeave={() => {
          // Child elements fire their own enter/leave; only reset on the real exit.
          depth.current = Math.max(0, depth.current - 1)
          if (depth.current === 0) {
            setOver(false)
            setPull({ x: 0, y: 0 })
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          depth.current = 0
          setOver(false)
          setPull({ x: 0, y: 0 })
          take(e.dataTransfer.files?.[0])
        }}
        onPointerMove={(e) => { if (e.pointerType === 'mouse') magnet(e) }}
        onPointerLeave={() => setPull({ x: 0, y: 0 })}
        className={[
          'group relative rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 text-sm cursor-pointer overflow-hidden select-none outline-none',
          'transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out',
          'focus-visible:ring-3 focus-visible:ring-primary/25',
          over
            ? 'border-solid border-primary bg-primary/[0.06] -translate-y-0.5 shadow-[0_10px_30px_-12px_rgb(43_58_103/0.45)] text-primary'
            : 'border-dashed border-border bg-white/40 text-muted-foreground hover:border-primary/50',
          className,
        ].join(' ')}
        style={showImage ? { backgroundImage: `url(${currentUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {showImage ? (
          <span className="absolute inset-x-0 bottom-0 bg-black/45 text-white text-xs font-semibold py-1.5 text-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150">
            Drop or click to replace
          </span>
        ) : (
          <>
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm border border-border transition-transform duration-200 ease-out motion-reduce:transition-none"
              style={{
                transform: `translate(${pull.x}px, ${pull.y}px) scale(${over ? 1.12 : 1}) rotate(${over ? pull.x * 0.5 : 0}deg)`,
              }}
              aria-hidden
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
            </span>
            <span className="font-medium">{uploading ? 'Uploading…' : over ? 'Drop to upload' : hint}</span>
            {!uploading && !over && <span className="text-xs opacity-70">PNG, JPG, WebP or GIF</span>}
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          take(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </>
  )
}
