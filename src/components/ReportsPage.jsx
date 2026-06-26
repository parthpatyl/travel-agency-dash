const formatUSD = (price) => price != null ? `$${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''

export default function ReportsPage({ bookings = [], packages = [], clients = [], settings = {} }) {
  const markupPercent = parseFloat(settings?.rules?.markup ?? settings?.defaultMarkup?.toString() ?? '15')
  const splitPercent = parseFloat(settings?.rules?.agentSplit ?? settings?.defaultAgentSplit?.toString() ?? '40')
  const inrToUsdRate = parseFloat(settings?.inrToUsdRate ?? 0)

  const toUSD = (inr) => inrToUsdRate > 0 ? inr / inrToUsdRate : null

  // Derive agents from real booking data — one row per unique non-empty agent
  const agentMap = new Map()
  bookings.forEach(b => {
    const name = (b.agent || '').trim()
    if (!name || name.toLowerCase() === 'unassigned') return
    if (!agentMap.has(name)) {
      agentMap.set(name, { name, bookings: 0, volume: 0 })
    }
    const entry = agentMap.get(name)
    entry.bookings += 1
    entry.volume += Number(b.amount) || 0
  })

  const agents = Array.from(agentMap.values())
    .map((ag) => {
      const totalMargin = ag.volume * (markupPercent / (100 + markupPercent))
      const commission = totalMargin * (splitPercent / 100)
      return {
        name: ag.name,
        bookings: ag.bookings,
        volume: `₹${ag.volume.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
        commission: `₹${commission.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
        usdVolume: formatUSD(toUSD(ag.volume)),
        usdCommission: formatUSD(toUSD(commission))
      }
    })
    .sort((a, b) => b.bookings - a.bookings)
    .map((ag, rankIdx) => ({ rank: rankIdx + 1, ...ag }))

  const destinationMetrics = packages.map(pkg => {
    const pkgBookings = bookings.filter(b => b.package.toLowerCase() === pkg.name.toLowerCase())
    const totalBookings = pkgBookings.length
    const volume = pkgBookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
    const costPrice = pkg.costPrice || 0
    const retailPrice = pkg.basePrice || 0
    const marginPerTour = costPrice > 0 ? retailPrice - costPrice : retailPrice * (markupPercent / (100 + markupPercent))
    const actualMarginPct = retailPrice > 0 ? (marginPerTour / retailPrice) * 100 : 0
    const netProfit = marginPerTour * (1 - (splitPercent / 100)) * totalBookings
    
    return {
      destination: `${pkg.name} (${pkg.region})`,
      totalBookings,
      volume: `₹${volume.toLocaleString('en-IN')}`,
      avgMargin: `${actualMarginPct.toFixed(1)}%`,
      netProfit: `₹${netProfit.toLocaleString('en-IN', {maximumFractionDigits: 0})}`,
      usdVolume: formatUSD(toUSD(volume)),
      usdNetProfit: formatUSD(toUSD(netProfit))
    }
  })

  const getCashFlow = () => {
    const periods = [
      { label: 'Jun 01 - Jun 15, 2026', start: new Date('2026-06-01'), end: new Date('2026-06-15') },
      { label: 'Jun 16 - Jun 30, 2026', start: new Date('2026-06-16'), end: new Date('2026-06-30') },
      { label: 'Jul 01 - Jul 15, 2026', start: new Date('2026-07-01'), end: new Date('2026-07-15') },
      { label: 'Jul 16 - Jul 30, 2026', start: new Date('2026-07-16'), end: new Date('2026-07-30') }
    ]
    
    return periods.map(p => {
      const periodBookings = bookings.filter(b => {
        const bDate = new Date(b.date)
        return bDate >= p.start && bDate <= p.end
      })
      
      const totalInflow = periodBookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
      const totalOutflow = totalInflow * (100 / (100 + markupPercent))
      const netFloat = totalInflow - totalOutflow
      
      return {
        period: p.label.replace(', 2026', ''),
        incomingPayments: `₹${totalInflow.toLocaleString('en-IN', {maximumFractionDigits: 0})}`,
        supplierPayouts: `₹${totalOutflow.toLocaleString('en-IN', {maximumFractionDigits: 0})}`,
        projectedCashFlow: `${netFloat >= 0 ? '+' : '-'}₹${Math.abs(netFloat).toLocaleString('en-IN', {maximumFractionDigits: 0})}`,
        status: netFloat > 0 ? 'Healthy' : netFloat === 0 ? 'Zero Float' : 'Deficit',
        usdIncoming: formatUSD(toUSD(totalInflow)),
        usdOutgoing: formatUSD(toUSD(totalOutflow)),
        usdNetFloat: toUSD(netFloat)
      }
    })
  }

  const cashFlowTimeline = getCashFlow()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-stone-900 tracking-tight">Intelligence & Agency Reports</h2>
        <p className="text-xs text-stone-400">Track agent productivity goals, evaluate margins, and monitor cash flows.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Left Column: Productivity and Yield (2 cols) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Agent Leaderboard */}
          <section className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-stone-200/50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">Agent Sales Performance</h3>
                <p className="text-[11px] text-stone-400">Monthly booking volumes and individual commission earnings.</p>
              </div>
              <span className="bg-amber-500/10 text-amber-705 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border border-amber-500/10">Active Period</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/50 border-b border-stone-200/50 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="py-3 px-6 text-center w-12">Rank</th>
                    <th className="py-3 px-6">Consultant</th>
                    <th className="py-3 px-6 text-center">Bookings</th>
                    <th className="py-3 px-6">Total Sales</th>
                    <th className="py-3 px-6">Est. Yield</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {agents.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-stone-400 text-xs">
                        No agents have been assigned to bookings yet.
                      </td>
                    </tr>
                  ) : agents.map((agent) => (
                    <tr key={agent.rank} className="hover:bg-stone-50/20 transition-colors duration-200 text-xs">
                      <td className="py-3 px-6 text-center font-bold text-stone-500">#{agent.rank}</td>
                      <td className="py-3 px-6 font-semibold text-stone-900">{agent.name}</td>
                      <td className="py-3 px-6 text-center font-medium text-stone-700">{agent.bookings}</td>
                      <td className="py-3 px-6 font-bold text-stone-800">
                        {agent.volume}
                        {inrToUsdRate > 0 && <span className="block text-[9px] text-stone-500 font-medium">{agent.usdVolume}</span>}
                      </td>
                      <td className="py-3 px-6 text-emerald-700 font-bold">
                        {agent.commission}
                        {inrToUsdRate > 0 && <span className="block text-[9px] text-stone-500 font-medium">{agent.usdCommission}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Destination Profit Margin Grid */}
          <section className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-stone-200/50">
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Destination Profitability Index</h3>
              <p className="text-[11px] text-stone-400">Total gross value compared against net yields for core target packages.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/50 border-b border-stone-200/50 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="py-3 px-6">Destination Location</th>
                    <th className="py-3 px-6 text-center">Booked Tours</th>
                    <th className="py-3 px-6">Total Revenue</th>
                    <th className="py-3 px-6 text-center">Avg Markup %</th>
                    <th className="py-3 px-6">Agency Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {destinationMetrics.map((dm, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/20 transition-colors duration-200 text-xs">
                      <td className="py-3 px-6 font-semibold text-stone-900">{dm.destination}</td>
                      <td className="py-3 px-6 text-center font-semibold text-stone-600">{dm.totalBookings}</td>
                      <td className="py-3 px-6 font-bold text-stone-800">
                        {dm.volume}
                        {inrToUsdRate > 0 && <span className="block text-[9px] text-stone-500 font-medium">{dm.usdVolume}</span>}
                      </td>
                      <td className="py-3 px-6 text-center text-stone-500 font-mono">{dm.avgMargin}</td>
                      <td className="py-3 px-6 font-extrabold text-amber-700">
                        {dm.netProfit}
                        {inrToUsdRate > 0 && <span className="block text-[9px] text-stone-500 font-medium">{dm.usdNetProfit}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Column: Capital Forecast (1 col) */}
        <div className="xl:col-span-1 space-y-6">
          {/* Capital & Cash Forecast */}
          <section className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm space-y-5">
            <div>
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Cash Flow & Payout Tracker</h3>
              <p className="text-[11px] text-stone-400">Track client collections against supplier payout cycles.</p>
            </div>

            <div className="space-y-4">
              {cashFlowTimeline.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-[#FAF9F5]/50 border border-stone-200/40 rounded-xl space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                    <span className="text-xs font-bold text-stone-800">{item.period}</span>
                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">
                      {item.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-1 text-[11px]">
                    <div>
                      <span className="text-[9px] text-stone-400 font-bold uppercase block">Inflow</span>
                      <span className="font-semibold text-stone-700">{item.incomingPayments}</span>
                      {inrToUsdRate > 0 && <span className="block text-[9px] text-stone-400">{item.usdIncoming}</span>}
                    </div>
                    <div>
                      <span className="text-[9px] text-stone-400 font-bold uppercase block">Outflow</span>
                      <span className="font-semibold text-stone-500">{item.supplierPayouts}</span>
                      {inrToUsdRate > 0 && <span className="block text-[9px] text-stone-400">{item.usdOutgoing}</span>}
                    </div>
                    <div>
                      <span className="text-[9px] text-amber-700 font-bold uppercase block">Net Float</span>
                      <span className="font-extrabold text-amber-800">{item.projectedCashFlow}</span>
                      {inrToUsdRate > 0 && <span className="block text-[9px] text-amber-600">{item.usdNetFloat != null ? `${item.usdNetFloat >= 0 ? '+' : '-'}$${Math.abs(item.usdNetFloat).toLocaleString('en-US', {maximumFractionDigits: 0})}` : ''}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
