import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <main className="min-h-screen bg-[#F7ECDC] p-8 text-[#1a1a1a] flex items-center justify-center">
      <div className="max-w-md rounded-2xl bg-[#FBF6EC] p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-black/40">404</p>
        <h1 className="font-display font-extrabold text-3xl mt-2">Page not found</h1>
        <p className="mt-2 text-black/70">The page you’re looking for doesn’t exist or has moved.</p>
        <Link to="/" className="mt-6 inline-block font-bold text-[#C9622E]">← Back to The Loyalty Loop</Link>
      </div>
    </main>
  )
}
