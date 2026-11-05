const api = require('../../utils/api')
const auth = require('../../utils/auth')
const filterStore = require('../../utils/filter')
const { findGame } = require('../../utils/games')
const { formatNum, formatYuan, formatRate, formatPctPoints, formatMinutes, formatDuration, formatTime, delta } = require('../../utils/format')
const { windowQuery, dateRangeQuery, dateKey, addDays } = require('../../utils/window')
const { blank, chartFrom, barsFrom, phrase } = require('../../utils/present')
const { sceneName } = require('../../utils/scenes')
const session = require('../../utils/session')

function safe(promise) {
  return promise.catch((error) => ({ ok: false, error: error.message || String(error) }))
}

function metric(label, value, sub, subColor) {
  return { label, value, sub: sub || '', subColor: subColor || '' }
}

function moneyNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function nullable(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function clockOf(label) {
  const text = String(label || '')
  const time = text.indexOf(' ') >= 0 ? text.split(' ').pop() : text
  return time || text
}

function shortDate(date) {
  const parts = String(date || '').split('-')
  if (parts.length < 3) return date
  return `${Number(parts[1])}-${Number(parts[2])}`
}

function rankBars(rows, labelKey, valueKey) {
  const list = (rows || []).slice(0, 8)
  const max = Math.max(...list.map((row) => Number(row[valueKey]) || 0), 1)
  return list.map((row) => ({
    label: phrase(row[labelKey]).slice(0, 12),
    pct: Math.round(((Number(row[valueKey]) || 0) / max) * 100),
    text: formatNum(row[valueKey]),
  }))
}

function sceneBars(rows, gameKey) {
  const list = (rows || []).slice().sort((a, b) => (
    (Number(b.ad_show_cnt) || 0) - (Number(a.ad_show_cnt) || 0)
  )).slice(0, 8)
  const max = Math.max(...list.map((row) => Number(row.ad_show_cnt) || 0), 1)
  return list.map((row) => ({
    label: sceneName(gameKey, row.scene),
    pct: Math.round(((Number(row.ad_show_cnt) || 0) / max) * 100),
    text: `${formatNum(row.ad_show_cnt)} 次`,
    wide: true,
  }))
}

function sheetCell(text, extra) {
  return Object.assign({ text: text == null || text === '' ? '-' : String(text), tag: '', tone: '' }, extra || {})
}

function rateCell(ready, live, value) {
  if (ready && value != null) return sheetCell(formatRate(value))
  if (live && value != null) return sheetCell(formatRate(value), { tag: '实时', tone: 'live' })
  return sheetCell('未成熟', { tone: 'muted' })
}

function statusTone(text) {
  return text.indexOf('已回本') >= 0 || text.indexOf('能回本') >= 0 ? 'up' : 'muted'
}

function paybackSheet(rows) {
  const columns = [
    { label: '日期', width: 168, pin: true },
    { label: '新增', width: 112 },
    { label: '消耗', width: 124 },
    { label: '回收', width: 168 },
    { label: '当天', width: 116 },
    { label: '次留', width: 168 },
    { label: '3留', width: 168 },
    { label: '7留', width: 168 },
    { label: '回本', width: 220 },
  ]
  return {
    width: columns.reduce((sum, col) => sum + col.width, 0),
    columns: columns.map((col) => Object.assign({}, col, { style: `width:${col.width}rpx` })),
    rows: rows.map((row) => {
      const status = paybackText(row)
      return {
        id: row.date,
        live: !!row.liveDay,
        detail: [
          `CPI ${row.spend > 0 && row.cpi != null ? formatYuan(row.cpi) : '-'}`,
          row.revenueLive ? '今天的回收按当前曝光估算' : '',
        ].filter(Boolean).join(' · '),
        cells: [
          sheetCell(shortDate(row.date), row.liveDay ? { tag: '今天' } : null),
          sheetCell(formatNum(row.newUsers)),
          sheetCell(formatYuan(row.spend)),
          sheetCell(formatYuan(row.revenue), row.revenueLive ? { tag: '估算' } : null),
          sheetCell(row.d0Roi == null ? '-' : formatRate(row.d0Roi)),
          rateCell(row.d1Ready, row.d1Live, row.d1),
          rateCell(row.d3Ready, row.d3Live, row.d3),
          rateCell(row.d7Ready, row.d7Live, row.d7),
          sheetCell(status, { tone: statusTone(status) }),
        ],
      }
    }),
  }
}

function seriesOf(ad) {
  if (!ad) return []
  if (ad.series_daily && ad.series_daily.length > 1) return ad.series_daily
  if (ad.series_hourly && ad.series_hourly.length > 1) return ad.series_hourly
  return ad.series || []
}

function pointAt(cohort, age) {
  const overall = cohort && cohort.overall
  const points = (overall && overall.points) || []
  return points.find((item) => item.age_day === age) || null
}

function weighted(pairs) {
  const weight = pairs.reduce((sum, item) => sum + item.weight, 0)
  if (!(weight > 0)) return null
  return pairs.reduce((sum, item) => sum + item.value * item.weight, 0) / weight
}

function paybackText(row) {
  if (row.spend <= 0) return '未投放'
  if (row.d7Roi != null && row.d7Roi >= 1) return '7日已回本'
  if (row.d3Roi != null && row.d3Roi >= 1) return '3日已回本'
  if (row.d0Roi != null && row.d0Roi >= 1) return '当天已回本'
  if (row.d30Roi != null && row.d30Roi >= 1) return '预测30天能回本'
  if (row.d3Roi == null) return '观察中'
  return '还没回本'
}

function verdictText(spend, d0, d3Roi, d30Roi) {
  if (!(spend > 0)) return '这段还没有投放消耗'
  if (d0 != null && d0 >= 1) return '这段投放当天已经收回成本'
  if (d3Roi != null && d3Roi >= 1) return '已出数的 3 日回收已经盖住获客成本'
  if (d30Roi != null && d30Roi >= 1) return '现在还没回本，预测 30 天可以收回'
  return '最近这段投放还没回本'
}

Page({
  data: { loading: true, refreshing: false, error: '', sections: [] },

  onShow() {
    auth.selectTab(this, 1)
    this.load()
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  onFilter() {
    this.load()
  },

  load() {
    const seq = (this._seq || 0) + 1
    this._seq = seq
    const current = filterStore.read()
    const game = findGame(current.gameKey)
    const key = ['dash', current.gameKey, current.platform, current.windowKey].join(':')
    this._key = key
    this._slot = {}
    this._pack = {}
    this._warn = ''
    session.showCached(this, key, ['sections'])
    const base = { game: current.gameKey, platform: current.platform }
    const query = Object.assign({}, base, windowQuery(current.windowKey))
    const compare = Object.assign({}, base, windowQuery(current.windowKey, -86400000))
    const dates = Object.assign({}, base, dateRangeQuery(current.windowKey))
    const prevDates = Object.assign({}, base, dateRangeQuery(current.windowKey, -86400000))
    const yesterday = addDays(dateKey(Date.now()), -1)
    const fromDate = addDays(yesterday, -13)
    const name = game.displayName
    const put = (id, section) => {
      if (seq !== this._seq || !section) return
      this._slot[id] = section
      this.flush(seq, false)
    }
    const remember = (part, value) => {
      if (seq !== this._seq) return
      this._pack[part] = value
      if (this._pack.overview && this._pack.ad && this._pack.cost) put('market', this.sectionMarket())
    }
    const jobs = [
      Promise.all([
        api.get('/api/realtime/overview', query),
        safe(api.get('/api/realtime/overview', compare)),
      ]).then(([overview, compareOv]) => {
        if (seq !== this._seq) return
        if (!overview || overview.ok === false) {
          this._warn = (overview && overview.error) || '大盘加载失败'
          this.flush(seq, false)
          remember('overview', { ok: false })
          remember('compareOverview', compareOv)
          return
        }
        this._warn = ''
        put('active', this.sectionActive(name, overview, compareOv, current.windowKey))
        put('duration', this.sectionDuration(overview))
        remember('overview', overview)
        remember('compareOverview', compareOv)
      }),
      Promise.all([
        safe(api.get('/api/realtime/ad-revenue', query)),
        safe(api.get('/api/realtime/ad-revenue', compare)),
      ]).then(([ad, compareAd]) => {
        put('ad', this.sectionAd(ad, current.gameKey))
        remember('ad', ad)
        remember('compareAd', compareAd)
      }),
      Promise.all([
        safe(api.get('/api/realtime/acquisition-cost', dates)),
        safe(api.get('/api/realtime/acquisition-cost', prevDates)),
      ]).then(([cost, compareCost]) => {
        remember('cost', cost)
        remember('compareCost', compareCost)
      }),
      Promise.all([
        safe(api.get('/api/realtime/online-curve', query)),
        safe(api.get('/api/realtime/online-curve', compare)),
      ]).then(([curve, compareCurve]) => put('online', this.sectionOnline(curve, compareCurve))),
      Promise.all([
        safe(api.get('/api/realtime/business-inputs', Object.assign({}, base, { from_date: fromDate, to_date: yesterday }))),
        safe(api.get('/api/realtime/retention-cohorts', Object.assign({}, base, { from_date: fromDate, to_date: yesterday, max_age: 7 }))),
        safe(api.get('/api/realtime/payback-today', base)),
      ]).then(([roi, retention, live]) => put('payback', this.sectionPayback(roi, retention, live))),
      safe(api.get('/api/realtime/share', query)).then((share) => put('share', this.sectionShare(share))),
      safe(api.get('/api/realtime/ad-errors', Object.assign({ limit: 8 }, query)))
        .then((errors) => put('errors', this.sectionErrors(errors, current.gameKey))),
    ]
    return Promise.all(jobs).then(() => {
      if (seq !== this._seq) return
      this.flush(seq, true)
    }).catch((error) => {
      if (seq !== this._seq) return
      session.fail(this, error)
    })
  },

  flush(seq, done) {
    if (seq !== this._seq) return
    const sections = ['active', 'market', 'online', 'duration', 'payback', 'ad', 'share', 'errors']
      .map((id) => this._slot[id])
      .filter(Boolean)
    this.setData({ sections, loading: false, refreshing: !done, error: this._warn || '' })
    if (done) session.save(this._key, { sections })
  },

  sectionActive(name, overview, compareOv, windowKey) {
    const kpi = overview.kpi || {}
    const prev = (compareOv && compareOv.ok !== false && compareOv.kpi) || {}
    const day = windowKey === 'today' || windowKey === 'yesterday'
    const dauDelta = delta(kpi.dau, prev.dau)
    const hourDelta = delta(kpi.active_users_1h, prev.active_users_1h)
    const newDelta = delta(kpi.new_users_today, prev.new_users_today)
    return blank(`${name} · 活跃`, {
      kpis: [
        metric(day ? '日活' : '窗口活跃', formatNum(kpi.dau), dauDelta.text, dauDelta.color),
        metric('人均时长', formatMinutes(kpi.minutes_per_user), kpi.avg_session_ms ? `单次 ${formatDuration(kpi.avg_session_ms)}` : ''),
        metric('近1小时', formatNum(kpi.active_users_1h), hourDelta.text, hourDelta.color),
        metric('新增', formatNum(kpi.new_users_today), newDelta.text, newDelta.color),
        metric('次留', formatRate(kpi.retention_d1_rate), kpi.retention_d1_cohort ? `${formatNum(kpi.retention_d1_returned)}/${formatNum(kpi.retention_d1_cohort)}` : ''),
        metric('7留', formatRate(kpi.retention_d7_rate), kpi.retention_d7_cohort ? `${formatNum(kpi.retention_d7_returned)}/${formatNum(kpi.retention_d7_cohort)}` : ''),
        metric('计算时刻', formatTime(kpi.computed_at)),
      ],
      chart: chartFrom(overview.series || [], 'bucket', [
        { key: 'active_users', name: '活跃' },
        { key: 'new_users', name: '新增' },
      ], 'count'),
    })
  },

  sectionMarket() {
    const pack = this._pack || {}
    const overview = pack.overview && pack.overview.ok !== false ? pack.overview : null
    const compareOv = pack.compareOverview && pack.compareOverview.ok !== false ? pack.compareOverview : null
    const ad = pack.ad && pack.ad.ok !== false ? pack.ad : null
    const compareAd = pack.compareAd && pack.compareAd.ok !== false ? pack.compareAd : null
    const cost = pack.cost
    const compareCost = pack.compareCost
    const kpi = (overview && overview.kpi) || {}
    const prevKpi = (compareOv && compareOv.kpi) || {}
    const adSum = (ad && ad.summary) || null
    const prevAd = (compareAd && compareAd.summary) || {}
    const spendOk = !!(cost && cost.ok !== false && cost.total_spend_cny != null)
    const prevSpendOk = !!(compareCost && compareCost.ok !== false && compareCost.total_spend_cny != null)
    const spend = spendOk ? Number(cost.total_spend_cny) : null
    const prevSpend = prevSpendOk ? Number(compareCost.total_spend_cny) : null
    const spendDelta = delta(spend, prevSpend)
    const newUsers = Number(kpi.new_users_today) || 0
    const prevNew = Number(prevKpi.new_users_today) || 0
    const cpi = spend != null && newUsers > 0 ? spend / newUsers : null
    const prevCpi = prevSpend != null && prevNew > 0 ? prevSpend / prevNew : null
    const cpiDelta = delta(cpi, prevCpi, true)
    const kpis = []
    if (spendOk) {
      kpis.push(metric('投放消耗', formatYuan(spend), spendDelta.text, spendDelta.color))
      kpis.push(metric('投放 CPI', cpi == null ? '-' : formatYuan(cpi), cpiDelta.text, cpiDelta.color))
    } else {
      const reason = (cost && (cost.error || cost.code)) || '消耗没读到'
      kpis.push(metric('投放消耗', '-', String(reason).slice(0, 24)))
      kpis.push(metric('投放 CPI', '-'))
    }
    if (adSum) {
      const pen = delta(adSum.ad_penetration_rate, prevAd.ad_penetration_rate)
      const per = delta(adSum.ad_show_per_uu, prevAd.ad_show_per_uu)
      const fill = delta(adSum.fill_rate, prevAd.fill_rate)
      const done = delta(adSum.completion_rate, prevAd.completion_rate)
      const rev = delta(adSum.total_revenue_estimated_cny, prevAd.total_revenue_estimated_cny)
      kpis.push(
        metric('广告渗透', formatPctPoints(adSum.ad_penetration_rate), pen.text, pen.color),
        metric('人均广告展示', adSum.ad_show_per_uu == null ? '-' : `${Number(adSum.ad_show_per_uu).toFixed(2)} 次`, per.text, per.color),
        metric('填充率', formatPctPoints(adSum.fill_rate), fill.text, fill.color),
        metric('完播率', formatPctPoints(adSum.completion_rate), done.text, done.color),
        metric('广告收益', formatYuan(adSum.total_revenue_estimated_cny), rev.text, rev.color),
      )
    } else if (pack.ad && pack.ad.ok === false) {
      kpis.push(metric('广告收益', '-', String(pack.ad.error || '广告没读到').slice(0, 24)))
    }
    if (!kpis.length) return null
    return blank('投放与商业化', {
      notice: '和昨日同一时段比。完播率是完播次数除以曝光次数',
      kpis,
    })
  },

  sectionOnline(curve, compare) {
    if (!curve || curve.ok === false) {
      return blank('实时在线', { error: (curve && (curve.error || curve.code)) || '在线曲线没读到' })
    }
    const points = curve.points || []
    if (points.length < 2) return blank('实时在线', { notice: '这个时间段还没有在线点' })
    const clocks = points.map((point) => clockOf(point.label))
    const unique = clocks.length === new Set(clocks).size
    const overlay = curve.bucket_minutes === 5
      && unique
      && compare
      && compare.ok !== false
      && compare.bucket_minutes === 5
    const byClock = {}
    if (overlay) {
      (compare.points || []).forEach((point) => { byClock[clockOf(point.label)] = point.online })
    }
    const rows = points.map((point) => ({
      label: point.label,
      online: point.online,
      yesterday: overlay && byClock[clockOf(point.label)] != null ? byClock[clockOf(point.label)] : null,
    }))
    const metrics = [{ key: 'online', name: '在线', color: '#1F4B99' }]
    if (overlay) metrics.push({ key: 'yesterday', name: '昨日同时', color: '#B45309' })
    const nowText = curve.live ? '当前' : '结束时'
    const grain = curve.bucket_minutes === 5 ? '每个点是最近 5 分钟有操作的人' : '跨度超过两天，按小时统计'
    return blank('实时在线', {
      notice: `${grain}。按住曲线看某一时刻`,
      kpis: [
        metric(nowText, formatNum(curve.current)),
        metric('峰值', formatNum(curve.peak), curve.peak_label || ''),
      ],
      chart: chartFrom(rows, 'label', metrics, 'count'),
    })
  },

  sectionDuration(overview) {
    const bins = (overview && overview.duration_histogram) || []
    if (!bins.length) return null
    const rows = bins.map((bin) => ({ label: `${bin.label}分`, users: bin.users }))
    const maxUsers = Math.max(...rows.map((item) => Number(item.users) || 0), 1)
    const bars = rows.length <= 16
      ? rows.map((row) => ({
        label: row.label,
        pct: Math.round(((Number(row.users) || 0) / maxUsers) * 100),
        text: formatNum(row.users),
      }))
      : barsFrom(rows, 'label', 'users')
    return blank('在线时长分布', {
      notice: '每人在当前时间段里累计在线多久',
      bars,
    })
  },

  sectionPayback(roi, retention, live) {
    const roiRows = (roi && roi.ok !== false && roi.rows) || []
    const cohorts = (retention && retention.ok !== false && retention.cohorts) || []
    const roiByDate = {}
    roiRows.forEach((row) => { roiByDate[row.date_key] = row })
    const cohortByDate = {}
    cohorts.forEach((row) => { cohortByDate[row.cohort_date] = row })
    const dates = Object.keys(Object.assign({}, roiByDate, cohortByDate)).sort().reverse()
    const rows = dates.map((date) => {
      const money = roiByDate[date] || {}
      const cohort = cohortByDate[date]
      const d1 = pointAt(cohort, 1)
      const d3 = pointAt(cohort, 3)
      const d7 = pointAt(cohort, 7)
      const overall = cohort && cohort.overall
      return {
        date,
        newUsers: money.game_new_users || (overall && overall.cohort_size) || 0,
        spend: moneyNum(money.spend_cny),
        revenue: moneyNum(money.wechat_ad_revenue_cny),
        revenueLive: false,
        liveDay: false,
        d0Roi: nullable(money.d0_roi),
        d1: d1 && d1.is_complete_day ? nullable(d1.retention_rate) : null,
        d1Ready: Boolean(d1 && d1.is_complete_day),
        d1Live: false,
        d3: d3 && d3.is_complete_day ? nullable(d3.retention_rate) : null,
        d3Ready: Boolean(d3 && d3.is_complete_day),
        d3Live: false,
        d3Roi: nullable(money.d3_roi),
        d7: d7 && d7.is_complete_day ? nullable(d7.retention_rate) : null,
        d7Ready: Boolean(d7 && d7.is_complete_day),
        d7Live: false,
        d7Roi: nullable(money.d7_roi),
        d30Roi: nullable(money.d30_projected_roi),
        cpi: nullable(money.cpi_cny),
      }
    })
    let liveError = ''
    if (live && live.ok && live.date_key) {
      (live.partials || []).forEach((partial) => {
        const row = rows.find((item) => item.date === partial.cohort_date)
        if (!row || partial.retention_rate == null) return
        if (partial.age_day === 1 && !row.d1Ready) {
          row.d1 = nullable(partial.retention_rate)
          row.d1Live = row.d1 != null
        } else if (partial.age_day === 3 && !row.d3Ready) {
          row.d3 = nullable(partial.retention_rate)
          row.d3Live = row.d3 != null
        } else if (partial.age_day === 7 && !row.d7Ready) {
          row.d7 = nullable(partial.retention_rate)
          row.d7Live = row.d7 != null
        }
      })
      rows.unshift({
        date: live.date_key,
        newUsers: live.new_users || 0,
        spend: moneyNum(live.spend_cny),
        revenue: moneyNum(live.revenue_cny),
        revenueLive: live.revenue_source !== 'publisher',
        liveDay: true,
        d0Roi: nullable(live.d0_roi),
        d1: null,
        d1Ready: false,
        d1Live: false,
        d3: null,
        d3Ready: false,
        d3Live: false,
        d3Roi: null,
        d7: null,
        d7Ready: false,
        d7Live: false,
        d7Roi: null,
        d30Roi: null,
        cpi: nullable(live.cpi_cny),
      })
    } else {
      const raw = String((live && (live.error || live.code)) || '')
      liveError = /not found/i.test(raw)
        ? '今天的实时留存还没发到线上，下面先显示已经过完的日期'
        : (raw || '今天的留存和回本没有算出来')
    }
    if (!rows.length) {
      return blank('留存与回本', { error: liveError || '近两周还没有回本数据' })
    }
    const spend = rows.reduce((sum, row) => sum + row.spend, 0)
    const revenue = rows.reduce((sum, row) => sum + row.revenue, 0)
    const d0 = spend > 0 ? revenue / spend : null
    const d1 = weighted(rows.filter((row) => row.d1Ready && row.d1 != null).map((row) => ({ value: row.d1, weight: row.newUsers })))
    const d3Roi = weighted(rows.filter((row) => row.d3Roi != null && row.spend > 0).map((row) => ({ value: row.d3Roi, weight: row.spend })))
    const d30Roi = weighted(rows.filter((row) => row.d30Roi != null && row.spend > 0).map((row) => ({ value: row.d30Roi, weight: row.spend })))
    const today = rows.find((row) => row.liveDay)
    const chartRows = rows.slice().sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({
      date: row.date,
      d1: row.d1 == null ? null : row.d1 * 100,
      d0: row.d0Roi == null ? null : row.d0Roi * 100,
      d3: row.d3Roi == null ? null : row.d3Roi * 100,
    }))
    return blank('留存与回本', {
      notice: `近 14 天加上今天。${verdictText(spend, d0, d3Roi, d30Roi)}`,
      error: liveError,
      kpis: [
        metric('消耗', formatYuan(spend)),
        metric('收入', formatYuan(revenue), today && today.revenueLive ? '含今天估算' : '含今天'),
        metric('当天收回', d0 == null ? '-' : formatRate(d0)),
        metric('加权次留', d1 == null ? '-' : formatRate(d1), '不含未定格'),
        metric('3日回收', d3Roi == null ? '-' : formatRate(d3Roi)),
      ],
      chart: chartFrom(chartRows, 'date', [
        { key: 'd1', name: '次留', color: '#1F4B99' },
        { key: 'd0', name: '当天回收', color: '#078A4D' },
        { key: 'd3', name: '3日回收', color: '#B45309' },
      ], 'pct'),
      sheet: paybackSheet(rows),
    })
  },

  sectionAd(ad, gameKey) {
    if (!ad || ad.ok === false) return null
    const adSum = ad.summary || {}
    const chart = chartFrom(seriesOf(ad), 'minute', [{ key: 'ad_revenue_estimated_cny', name: '估算收入' }], 'yuan')
    const bars = sceneBars(ad.breakdown_by_scene, gameKey)
    if (!chart && !bars.length) return null
    const rawNotice = ad.notice || ''
    return blank('广告走势', {
      notice: /尚未结算/.test(rawNotice) ? '今天还没结算，收益按近 14 天真实千次曝光收入估算' : rawNotice,
      kpis: [
        metric('曝光', formatNum(adSum.total_show)),
        metric('千次曝光收入', formatYuan(adSum.avg_ecpm_cny)),
      ],
      chart,
      bars,
    })
  },

  sectionShare(share) {
    if (!share || share.ok === false || !share.kpi) return null
    const sk = share.kpi
    return blank('分享', {
      kpis: [
        metric('次数', formatNum(sk.share_count)),
        metric('人数', formatNum(sk.share_users)),
        metric('渗透', formatPctPoints(sk.share_penetration_rate)),
        metric('人均', sk.share_per_user == null ? '-' : Number(sk.share_per_user).toFixed(2)),
      ],
      chart: chartFrom(share.series_hourly || [], 'hour', [
        { key: 'share_count', name: '次数' },
        { key: 'share_users', name: '人数' },
      ], 'count'),
      bars: rankBars(share.breakdown_by_entry || [], 'entry_point', 'share_count'),
    })
  },

  sectionErrors(errors, gameKey) {
    if (!errors || errors.ok === false || !errors.errors || !errors.errors.length) return null
    return blank(`广告错误 ${formatNum(errors.total_errors)}`, {
      lines: errors.errors.slice(0, 8).map((row) => `${sceneName(gameKey, row.scene)} · ${row.err_code || '-'} · ${formatNum(row.count)} · ${row.err_msg || ''}`),
    })
  },
})
