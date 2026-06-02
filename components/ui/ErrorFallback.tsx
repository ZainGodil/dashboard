'use client'

import { useEffect } from 'react'

export default function ErrorFallback({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard error]', error)
  }, [error])

  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="text-center max-w-xs">
        <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#EF4444" strokeWidth="1.5">
            <circle cx="10" cy="10" r="8"/>
            <path d="M10 6v4M10 14h.01"/>
          </svg>
        </div>
        <h2 className="font-display text-[15px] font-bold text-slate-800 mb-1">Something went wrong</h2>
        <p className="text-[12px] text-slate-400 mb-5 leading-relaxed">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 text-white text-[12px] font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
