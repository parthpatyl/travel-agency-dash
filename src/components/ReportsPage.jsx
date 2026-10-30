import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'

const formatUSD = (price) => price != null ? `$${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''

export default function ReportsPage({
  bookings = [],
  packages = [],
  settings = {},
  user,
  token,
  enquiries: propEnquiries,
  API_URL,
  addNotification
}) {
  const markupPercent = parseFloat(settings?.rules?.markup ?? settings?.defaultMarkup?.toString() ?? '15')
  const splitPercent = parseFloat(settings?.rules?.agentSplit ?? settings?.defaultAgentSplit?.toString() ?? '40')
  const inrToUsdRate = parseFloat(settings?.inrToUsdRate ?? 0)

  const toUSD = (inr) => inrToUsdRate > 0 && inr != null ? inr / inrToUsdRate : null

  // Enquiries state (use propEnquiries if provided, otherwise fetch)
  const [enquiries, setEnquiries] = useState(propEnquiries || [])

  useEffect(() => {
    if (propEnquiries && propEnquiries.length > 0) {
      setEnquiries(propEnquiries)
      return
    }
    const fetchEnquiries = async () => {
      try {
        const baseUrl = API_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000'
        const authToken = token || localStorage.getItem('kraft_token')
        const res = await fetch(`${baseUrl}/api/enquiries`, {
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        })
        if (res.ok) {
          const json = await res.json()
          setEnquiries(json.data || [])
        }
      } catch {
        // offline fallback
      }
    }
    fetchEnquiries()
  }, [propEnquiries, API_URL, token])

  // Date Range Filter States
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Quick Preset Handlers
  const handlePreset = (type) => {
    const now = new Date()
    if (type === 'all') {
      setFromDate('')
      setToDate('')
    } else if (type === 'thisMonth') {
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      setFromDate(`${year}-${month}-01`)
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()
      setToDate(`${year}-${month}-${String(lastDay).padStart(2, '0')}`)
    } else if (type === 'last30') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      setFromDate(past.toISOString().substring(0, 10))
      setToDate(now.toISOString().substring(0, 10))
    } else if (type === 'thisYear') {
      const year = now.getFullYear()
      setFromDate(`${year}-01-01`)
      setToDate(`${year}-12-31`)
    }
  }

  // Filter Bookings by Date Range
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const d = (b.date || '').substring(0, 10)
      if (fromDate && d && d < fromDate) return false
      if (toDate && d && d > toDate) return false
      return true
    })
  }, [bookings, fromDate, toDate])

  // Filter Enquiries by Date Range
  const filteredEnquiries = useMemo(() => {
    return enquiries.filter(e => {
      const d = (e.submittedAt || e.travelDate || '').substring(0, 10)
      if (fromDate && d && d < fromDate) return false
      if (toDate && d && d > toDate) return false
      return true
    })
  }, [enquiries, fromDate, toDate])

  // ─────────────────────────────────────────────
  // 1. EXECUTIVE KPI METRICS
  // ─────────────────────────────────────────────
  const totalQueriesReceived = filteredEnquiries.length + filteredBookings.length

  const confirmedBookings = useMemo(() => {
    return filteredBookings.filter(b => {
      const st = (b.status || '').toLowerCase()
      return st === 'confirmed' || st === 'paid'
    })
  }, [filteredBookings])

  const lostBookings = useMemo(() => {
    return filteredBookings.filter(b => (b.status || '').toLowerCase() === 'cancelled')
  }, [filteredBookings])

  const confirmedCount = confirmedBookings.length
  const lostCount = lostBookings.length
  const activeCount = filteredBookings.filter(b => (b.status || '').toLowerCase() !== 'cancelled').length

  const conversionRatePct = totalQueriesReceived > 0
    ? ((confirmedCount / totalQueriesReceived) * 100).toFixed(1)
    : '0.0'

  const lossRatePct = totalQueriesReceived > 0
    ? ((lostCount / totalQueriesReceived) * 100).toFixed(1)
    : '0.0'

  const totalGrossSales = confirmedBookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
  const totalLostRevenue = lostBookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
  const avgBookingValue = confirmedCount > 0 ? Math.round(totalGrossSales / confirmedCount) : 0

  const totalMargin = totalGrossSales * (markupPercent / (100 + markupPercent))
  const netProfit = totalMargin * (1 - (splitPercent / 100))

  // ─────────────────────────────────────────────
  // 2. LOST QUERIES BREAKDOWN BY CANCELLATION REASON
  // ─────────────────────────────────────────────
  const lostReasonsBreakdown = useMemo(() => {
    const map = new Map()
    lostBookings.forEach(b => {
      const reason = (b.cancellationReason || '').trim() || 'Price too high / Budget constraints'
      if (!map.has(reason)) {
        map.set(reason, { reason, count: 0, lostRevenue: 0 })
      }
      const entry = map.get(reason)
      entry.count += 1
      entry.lostRevenue += Number(b.amount) || 0
    })

    return Array.from(map.values())
      .map(item => ({
        ...item,
        sharePct: lostCount > 0 ? ((item.count / lostCount) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => b.count - a.count)
  }, [lostBookings, lostCount])

  // ─────────────────────────────────────────────
  // 3. ACQUISITION CHANNEL BREAKDOWN
  // ─────────────────────────────────────────────
  const channelBreakdown = useMemo(() => {
    const map = new Map()

    // Aggregate from Bookings
    filteredBookings.forEach(b => {
      const channel = b.leadSource || (b.isItineraryDownload ? 'Itinerary Download' : 'Direct/Other')
      if (!map.has(channel)) {
        map.set(channel, { channel, queries: 0, confirmed: 0, lost: 0, revenue: 0 })
      }
      const entry = map.get(channel)
      entry.queries += 1
      const st = (b.status || '').toLowerCase()
      if (st === 'confirmed' || st === 'paid') {
        entry.confirmed += 1
        entry.revenue += Number(b.amount) || 0
      } else if (st === 'cancelled') {
        entry.lost += 1
      }
    })

    // Aggregate from Enquiries
    filteredEnquiries.forEach(e => {
      const channel = e.leadSource || (e.isItineraryDownload ? 'Itinerary Download' : 'Direct/Other')
      if (!map.has(channel)) {
        map.set(channel, { channel, queries: 0, confirmed: 0, lost: 0, revenue: 0 })
      }
      const entry = map.get(channel)
      entry.queries += 1
      if (e.status === 'converted') {
        entry.confirmed += 1
      }
    })

    return Array.from(map.values())
      .map(ch => ({
        ...ch,
        conversionRate: ch.queries > 0 ? ((ch.confirmed / ch.queries) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => b.queries - a.queries)
  }, [filteredBookings, filteredEnquiries])

  // ─────────────────────────────────────────────
  // 4. MULTI-SHEET EXCEL EXPORT (R10)
  // ─────────────────────────────────────────────
  const handleDownloadFullReport = () => {
    const workbook = XLSX.utils.book_new()

    // Sheet 1: Executive KPI Summary
    const kpiData = [
      { Metric: 'Reporting Period', Value: `${fromDate || 'All Time'} to ${toDate || 'Present'}` },
      { Metric: 'Total Queries / Leads Received', Value: totalQueriesReceived },
      { Metric: 'Confirmed Bookings', Value: confirmedCount },
      { Metric: 'Active / Scheduled Bookings', Value: activeCount },
      { Metric: 'Lost Queries / Cancellations', Value: lostCount },
      { Metric: 'Lead Conversion Rate', Value: `${conversionRatePct}%` },
      { Metric: 'Query Loss Rate', Value: `${lossRatePct}%` },
      { Metric: 'Gross Sales Revenue (INR)', Value: totalGrossSales },
      { Metric: 'Gross Sales Revenue (USD)', Value: formatUSD(toUSD(totalGrossSales)) },
      { Metric: 'Total Lost Revenue (INR)', Value: totalLostRevenue },
      { Metric: 'Total Lost Revenue (USD)', Value: formatUSD(toUSD(totalLostRevenue)) },
      { Metric: 'Average Booking Value (INR)', Value: avgBookingValue },
      { Metric: 'Average Booking Value (USD)', Value: formatUSD(toUSD(avgBookingValue)) },
      { Metric: 'Estimated Net Agency Profit (INR)', Value: Math.round(netProfit) },
      { Metric: 'Estimated Net Agency Profit (USD)', Value: formatUSD(toUSD(netProfit)) }
    ]
    const wsKpi = XLSX.utils.json_to_sheet(kpiData)
    XLSX.utils.book_append_sheet(workbook, wsKpi, 'Executive Summary')

    // Sheet 2: Lost Queries Breakdown
    const lostData = lostReasonsBreakdown.map(item => ({
      'Cancellation Reason': item.reason,
      'Lost Lead Count': item.count,
      'Share of Lost Leads (%)': `${item.sharePct}%`,
      'Lost Revenue (INR)': item.lostRevenue,
      'Lost Revenue (USD)': formatUSD(toUSD(item.lostRevenue))
    }))
    const wsLost = XLSX.utils.json_to_sheet(
      lostData.length > 0
        ? lostData
        : [{ 'Cancellation Reason': 'No cancellations in period', 'Lost Lead Count': 0, 'Share of Lost Leads (%)': '0%', 'Lost Revenue (INR)': 0, 'Lost Revenue (USD)': '$0' }]
    )
    XLSX.utils.book_append_sheet(workbook, wsLost, 'Lost Queries Breakdown')

    // Sheet 3: Acquisition Channel Breakdown
    const channelData = channelBreakdown.map(ch => ({
      'Acquisition Channel': ch.channel,
      'Total Queries / Leads': ch.queries,
      'Confirmed Bookings': ch.confirmed,
      'Lost Queries': ch.lost,
      'Conversion Rate (%)': `${ch.conversionRate}%`,
      'Revenue Generated (INR)': ch.revenue,
      'Revenue Generated (USD)': formatUSD(toUSD(ch.revenue))
    }))
    const wsChannel = XLSX.utils.json_to_sheet(
      channelData.length > 0
        ? channelData
        : [{ 'Acquisition Channel': 'None', 'Total Queries / Leads': 0, 'Confirmed Bookings': 0, 'Lost Queries': 0, 'Conversion Rate (%)': '0%', 'Revenue Generated (INR)': 0, 'Revenue Generated (USD)': '$0' }]
    )
    XLSX.utils.book_append_sheet(workbook, wsChannel, 'Acquisition Channels')

    // Sheet 4: Bookings & Revenue Detail
    const bookingDetailData = filteredBookings.map(b => ({
      'Booking ID': b.id,
      'Client Name': b.client,
      'Package': b.package,
      'Amount (INR)': Number(b.amount) || 0,
      'Amount (USD)': formatUSD(b.usdAmount || toUSD(b.amount)),
      'Departure Date': b.date,
      'Status': b.status || 'Pending',
      'Cancellation Reason': b.cancellationReason || '—',
      'Lead Source': b.leadSource || (b.isItineraryDownload ? 'Itinerary Download' : 'Direct/Other'),
      'Consultant / Agent': b.agent || 'Unassigned'
    }))
    const wsBookings = XLSX.utils.json_to_sheet(
      bookingDetailData.length > 0
        ? bookingDetailData
        : [{ 'Booking ID': 'None', 'Client Name': '—', 'Package': '—', 'Amount (INR)': 0, 'Departure Date': '—', 'Status': '—', 'Cancellation Reason': '—', 'Lead Source': '—' }]
    )
    XLSX.utils.book_append_sheet(workbook, wsBookings, 'Bookings Detail')

    // Sheet 5: Enquiries Detail
    const enquiryDetailData = filteredEnquiries.map(e => ({
      'Enquiry ID': e.id,
      'Customer Name': e.name,
      'Email': e.email,
      'Phone': e.phone || '—',
      'Destination': e.destination,
      'Travel Date': e.travelDate,
      'Guests': e.guests,
      'Status': e.status,
      'Lead Source': e.leadSource || (e.isItineraryDownload ? 'Itinerary Download' : 'Direct/Other'),
      'Referral Name': e.referralName || '—',
      'Submitted At': e.submittedAt || ''
    }))
    const wsEnquiries = XLSX.utils.json_to_sheet(
      enquiryDetailData.length > 0
        ? enquiryDetailData
        : [{ 'Enquiry ID': 'None', 'Customer Name': '—', 'Email': '—', 'Destination': '—', 'Status': '—', 'Lead Source': '—' }]
    )
    XLSX.utils.book_append_sheet(workbook, wsEnquiries, 'Enquiries Detail')

    XLSX.writeFile(workbook, `kraft_full_executive_report_${new Date().toISOString().substring(0, 10)}.xlsx`)
    if (addNotification) {
      addNotification('Comprehensive multi-sheet report downloaded successfully (.xlsx)', 'success')
    }
  }

  // ─────────────────────────────────────────────
  // 5. AGENT PERFORMANCE & DESTINATION MARGINS (Powered by filteredBookings)
  // ─────────────────────────────────────────────
  const agentMap = new Map()
  filteredBookings.forEach(b => {
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
      const agMargin = ag.volume * (markupPercent / (100 + markupPercent))
      const commission = agMargin * (splitPercent / 100)
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
    const pkgBookings = filteredBookings.filter(b => (b.package || '').toLowerCase() === (pkg.name || '').toLowerCase())
    const totalBookings = pkgBookings.length
    const volume = pkgBookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
    const costPrice = pkg.costPrice || 0
    const retailPrice = pkg.basePrice || 0
    const marginPerTour = costPrice > 0 ? retailPrice - costPrice : retailPrice * (markupPercent / (100 + markupPercent))
    const actualMarginPct = retailPrice > 0 ? (marginPerTour / retailPrice) * 100 : 0
    const pkgNetProfit = marginPerTour * (1 - (splitPercent / 100)) * totalBookings

    return {
      destination: `${pkg.name} (${pkg.region})`,
      totalBookings,
      volume: `₹${volume.toLocaleString('en-IN')}`,
      avgMargin: `${actualMarginPct.toFixed(1)}%`,
      netProfit: `₹${pkgNetProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      usdVolume: formatUSD(toUSD(volume)),
      usdNetProfit: formatUSD(toUSD(pkgNetProfit))
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
      const periodBookings = filteredBookings.filter(b => {
        const bDate = new Date(b.date)
        return bDate >= p.start && bDate <= p.end
      })

      const totalInflow = periodBookings.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
      const totalOutflow = totalInflow * (100 / (100 + markupPercent))
      const netFloat = totalInflow - totalOutflow

      return {
        period: p.label.replace(', 2026', ''),
        incomingPayments: `₹${totalInflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
        supplierPayouts: `₹${totalOutflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
        projectedCashFlow: `${netFloat >= 0 ? '+' : '-'}₹${Math.abs(netFloat).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
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
      {/* Page Header with Date Filter Toolbar and Excel Export */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-stone-200/80">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <span>Intelligence & Agency Reports</span>
          </h2>
          <p className="text-xs text-stone-500 font-light mt-0.5">
            Executive conversion analytics, lost lead post-mortems, marketing channel yields, and capital forecasts.
          </p>
        </div>

        {/* Date Range Toolbar & Export Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Preset Buttons */}
          <div className="inline-flex rounded-xl bg-stone-100 p-1 border border-stone-200 text-xs font-semibold">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'thisMonth', label: 'This Month' },
              { id: 'last30', label: 'Last 30 Days' },
              { id: 'thisYear', label: 'This Year' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePreset(p.id)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-stone-600 hover:text-stone-900 hover:bg-white/80 transition-all cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Pickers */}
          <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-xl px-2.5 py-1 text-xs shadow-xs">
            <span className="text-[10px] font-bold text-stone-400 uppercase">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-stone-700 outline-none text-xs cursor-pointer font-medium"
              title="Start date filter"
              aria-label="Start date filter"
            />
            <span className="text-[10px] font-bold text-stone-400 uppercase ml-1">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-stone-700 outline-none text-xs cursor-pointer font-medium"
              title="End date filter"
              aria-label="End date filter"
            />
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="text-stone-400 hover:text-stone-600 text-xs px-1 cursor-pointer font-bold"
                title="Reset date filter"
              >
                ✕
              </button>
            )}
          </div>

          {/* Download Full Report (.xlsx) */}
          <button
            type="button"
            onClick={handleDownloadFullReport}
            className="py-2 px-3.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Download multi-sheet executive analytics workbook (.xlsx)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Full Report (.xlsx)
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────── */}
      {/* 6 EXECUTIVE KPI SUMMARY CARDS */}
      {/* ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <div className="p-4 bg-white border border-stone-200/80 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Leads &amp; Queries</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-stone-900">{totalQueriesReceived}</span>
            <span className="text-[10px] text-stone-400 font-medium">total</span>
          </div>
          <p className="text-[10px] text-stone-500 font-light truncate">
            {filteredEnquiries.length} enq · {filteredBookings.length} bookings
          </p>
        </div>

        <div className="p-4 bg-white border border-stone-200/80 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Confirmed Bookings</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-emerald-700">{confirmedCount}</span>
            <span className="text-[10px] text-emerald-600 font-semibold">{conversionRatePct}% conv</span>
          </div>
          <p className="text-[10px] text-stone-400 font-light truncate">{activeCount} active in pipeline</p>
        </div>

        <div className="p-4 bg-white border border-stone-200/80 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Lost Leads / Cancelled</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-rose-600">{lostCount}</span>
            <span className="text-[10px] text-rose-500 font-semibold">{lossRatePct}% loss rate</span>
          </div>
          <p className="text-[10px] text-stone-400 font-light truncate">{lostReasonsBreakdown.length} unique reasons</p>
        </div>

        <div className="p-4 bg-white border border-stone-200/80 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-stone-700 uppercase tracking-wider block">Gross Sales Value</span>
          <div className="text-xl font-extrabold text-stone-900 truncate">
            ₹{totalGrossSales.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-stone-400 font-light truncate">
            {inrToUsdRate > 0 ? formatUSD(toUSD(totalGrossSales)) : 'Confirmed & Paid'}
          </p>
        </div>

        <div className="p-4 bg-white border border-stone-200/80 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Lost Lead Revenue</span>
          <div className="text-xl font-extrabold text-rose-600 truncate">
            ₹{totalLostRevenue.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-stone-400 font-light truncate">
            {inrToUsdRate > 0 ? formatUSD(toUSD(totalLostRevenue)) : 'Value of lost trips'}
          </p>
        </div>

        <div className="p-4 bg-white border border-stone-200/80 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Avg Booking Value</span>
          <div className="text-xl font-extrabold text-amber-800 truncate">
            ₹{avgBookingValue.toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-stone-400 font-light truncate">
            Est. Net: ₹{Math.round(netProfit).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* ───────────────────────────────────────────── */}
      {/* LOST LEADS & ACQUISITION BREAKDOWNS (R8 & R9) */}
      {/* ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Lost Queries & Reason Breakdown */}
        <section className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <span>Lost Queries Post-Mortem</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  {lostCount} Lost
                </span>
              </h3>
              <p className="text-[11px] text-stone-400">
                Primary reasons logged during cancellation prompts and their financial impact.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50/70 border-b border-stone-100 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Cancellation Reason</th>
                  <th className="py-2.5 px-3 text-center">Lost Leads</th>
                  <th className="py-2.5 px-3 text-center">Share</th>
                  <th className="py-2.5 px-4 text-right">Lost Value (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lostReasonsBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-stone-400 text-xs italic">
                      No cancellations recorded in this time period.
                    </td>
                  </tr>
                ) : (
                  lostReasonsBreakdown.map((item, idx) => (
                    <tr key={idx} className="hover:bg-rose-50/20 transition-colors">
                      <td className="py-3 px-4 font-semibold text-stone-800 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span>{item.reason}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-stone-700">{item.count}</td>
                      <td className="py-3 px-3 text-center text-stone-500 font-mono text-[11px]">{item.sharePct}%</td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">
                        ₹{item.lostRevenue.toLocaleString('en-IN')}
                        {inrToUsdRate > 0 && <span className="block text-[9px] text-stone-400 font-normal">{formatUSD(toUSD(item.lostRevenue))}</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Acquisition Channel Breakdown */}
        <section className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <span>Acquisition Channels Performance</span>
              </h3>
              <p className="text-[11px] text-stone-400">
                Lead capture channels, conversion rates, and total sales yield.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50/70 border-b border-stone-100 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Channel / Source</th>
                  <th className="py-2.5 px-3 text-center">Total Queries</th>
                  <th className="py-2.5 px-3 text-center">Converted</th>
                  <th className="py-2.5 px-3 text-center">Conv %</th>
                  <th className="py-2.5 px-4 text-right">Revenue (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {channelBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-stone-400 text-xs italic">
                      No acquisition channel records found.
                    </td>
                  </tr>
                ) : (
                  channelBreakdown.map((ch, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-3 px-4 font-semibold text-stone-800">
                        <span className="inline-flex items-center gap-1.5">
                          {ch.channel === 'Itinerary Download' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700">PDF</span>
                          )}
                          <span>{ch.channel}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-stone-700">{ch.queries}</td>
                      <td className="py-3 px-3 text-center text-emerald-700 font-bold">{ch.confirmed}</td>
                      <td className="py-3 px-3 text-center font-mono text-[11px] text-stone-600">{ch.conversionRate}%</td>
                      <td className="py-3 px-4 text-right font-bold text-stone-900">
                        ₹{ch.revenue.toLocaleString('en-IN')}
                        {inrToUsdRate > 0 && <span className="block text-[9px] text-stone-400 font-normal">{formatUSD(toUSD(ch.revenue))}</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ───────────────────────────────────────────── */}
      {/* AGENT LEADERBOARD, DESTINATION MARGINS, & CASH FLOW */}
      {/* ───────────────────────────────────────────── */}
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
              <span className="bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border border-amber-500/10">Active Period</span>
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
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Cash Flow &amp; Payout Tracker</h3>
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
