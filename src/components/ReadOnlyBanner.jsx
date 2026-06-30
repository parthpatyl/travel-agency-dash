export default function ReadOnlyBanner({ message = 'View-only mode' }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
      <svg className="w-4 h-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
      <span className="font-semibold">{message}</span>
    </div>
  )
}
