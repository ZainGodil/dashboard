'use client'

export default function CsvButton({
  filename,
  headers,
  rows,
}: {
  filename: string
  headers: string[]
  rows: (string | number)[][]
}) {
  function download() {
    const escape = (v: string | number) => {
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }
    const csv = [headers.map(escape), ...rows.map((r) => r.map(escape))]
      .map((r) => r.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={download}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 2v8M5 7l3 3 3-3M2 13h12"/>
      </svg>
      Export CSV
    </button>
  )
}
