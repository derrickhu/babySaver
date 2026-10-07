const api = require('../../utils/api')
const auth = require('../../utils/auth')
const filterStore = require('../../utils/filter')
const { findGame } = require('../../utils/games')
const { formatNum, formatYuan, formatRate, formatPctPoints, formatMinutes, formatDuration, delta } = require('../../utils/format')
const { windowQuery, dateRangeQuery, dateKey, addDays } = require('../../utils/window')
const { blank, chartFrom, phrase } = require('../../utils/present')
const session = require('../../utils/session')

function safe(promise) {
  return promise.catch((error) => ({ ok: false, error: error.message || String(error) }))
}

function metric(label, value, sub, subColor) {
  return { label, value, sub: sub || '', subColor: subColor || '' }
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

function sceneBars(rows) {
  return rankBars(rows || [], 'scene', 'ad_show_cnt').map((bar, index) => {
    const row = (rows || [])[index] || {}
    return Object.assign({}, bar, { text: formatYuan(row.ad_revenue_estimated_cny) })
  })
}

function seriesOf(ad) {
  if (!ad) return []
  if (ad.series_daily && ad.series_daily.length > 1) return ad.series_daily
  if (ad.series_hourly && ad.series_hourly.length > 1) return ad.series_hourly
  return ad.series || []
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
    this._warn = ''
    session.showCached(this, key, ['sections'])
    const base = { game: current.gameKey, platform: current.platform }
    const query = Object.assign({}, base, windowQuery(current.windowKey))
    const compare = Object.assign({}, base, windowQuery(current.windowKey, -86400000))
    const dates = Object.assign({}, base, dateRangeQuery(current.windowKey))
    const prevDates = Object.assign({}, base, dateRangeQuery(current.windowKey, -86400000))
    const roiTo = addDays(dateKey(Date.now()), -4)
    const roiFrom = addDays(roiTo, -30)
    const name = game.displayName
    const put = (id, section) => {
      if (seq !== this._seq || !section) return
      this._slot[id] = section
      this.flush(seq, false)
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
          return
        }
        this._warn = ''
        put('active', this.sectionActive(name, overview, compareOv))
      }),
      Promise.all([
        safe(api.get('/api/realtime/ad-revenue', query)),
        safe(api.get('/api/realtime/ad-revenue', compare)),
      ]).then(([ad, compareAd]) => put('ad', this.sectionAd(ad, compareAd))),
      Promise.all([
        safe(api.get('/api/realtime/acquisition-cost', dates)),
        safe(api.get('/api/realtime/acquisition-cost', prevDates)),
      ]).then(([cost, compareCost]) => put('cost', this.sectionCost(cost, compareCost))),
      safe(api.get('/api/realtime/share', query)).then((share) => put('share', this.sectionShare(share))),
      safe(api.get('/api/realtime/business-inputs', Object.assign({}, base, { from_date: roiFrom, to_date: roiTo })))
        .then((roi) => put('roi', this.sectionRoi(roi))),
      safe(api.get('/api/realtime/ad-errors', Object.assign({ limit: 8 }, query)))
        .then((errors) => put('errors', this.sectionErrors(errors))),
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
    const sections = ['active', 'ad', 'cost', 'share', 'roi', 'errors']
      .map((id) => this._slot[id])
      .filter(Boolean)
    this.setData({ sections, loading: false, refreshing: !done, error: this._warn || '' })
    if (done) session.save(this._key, { sections })
  },

  sectionActive(name, overview, compareOv) {
    const kpi = overview.kpi || {}
    const prev = (compareOv && compareOv.kpi) || {}
    const dauDelta = delta(kpi.dau, prev.dau)
    const newDelta = delta(kpi.new_users_today, prev.new_users_today)
    return blank(`${name} · 活跃`, {
      kpis: [
        metric('日活', formatNum(kpi.dau), dauDelta.text, dauDelta.color),
        metric('近1小时', formatNum(kpi.active_users_1h)),
        metric('新增', formatNum(kpi.new_users_today), newDelta.text, newDelta.color),
        metric('次留', formatRate(kpi.retention_d1_rate), kpi.retention_d1_cohort ? `${formatNum(kpi.retention_d1_returned)}/${formatNum(kpi.retention_d1_cohort)}` : ''),
        metric('7留', formatRate(kpi.retention_d7_rate), kpi.retention_d7_cohort ? `${formatNum(kpi.retention_d7_returned)}/${formatNum(kpi.retention_d7_cohort)}` : ''),
        metric('人均时长', formatMinutes(kpi.minutes_per_user), kpi.avg_session_ms ? `单次 ${formatDuration(kpi.avg_session_ms)}` : ''),
      ],
      chart: chartFrom(overview.series || [], 'bucket', [{ key: 'active_users', name: '活跃' }], 'count'),
    })
  },

  sectionAd(ad, compareAd) {
    if (!ad) return null
    const adSum = ad.summary || {}
    const prevAd = (compareAd && compareAd.summary) || {}
    const revenueDelta = delta(adSum.total_revenue_estimated_cny, prevAd.total_revenue_estimated_cny)
    return blank('广告', {
      notice: ad.ok === false ? ad.error : ad.notice || '',
      kpis: ad.ok !== false ? [
        metric('估算收入', formatYuan(adSum.total_revenue_estimated_cny), revenueDelta.text, revenueDelta.color),
        metric('曝光', formatNum(adSum.total_show)),
        metric('渗透', formatPctPoints(adSum.ad_penetration_rate), `人均 ${adSum.ad_show_per_uu == null ? '-' : Number(adSum.ad_show_per_uu).toFixed(2)}`),
        metric('填充率', formatPctPoints(adSum.fill_rate)),
        metric('完播率', formatPctPoints(adSum.completion_rate)),
        metric('千次曝光收入', formatYuan(adSum.avg_ecpm_cny), `人均日收入 ${formatYuan(adSum.arpdau_estimated_cny)}`),
      ] : [],
      chart: chartFrom(seriesOf(ad), 'minute', [{ key: 'ad_revenue_estimated_cny', name: '估算收入' }], 'yuan'),
      bars: sceneBars(ad.breakdown_by_scene),
    })
  },

  sectionCost(cost, compareCost) {
    if (!cost || cost.ok === false) return null
    const spendDelta = delta(cost.total_spend_cny, compareCost && compareCost.total_spend_cny, true)
    return blank('今日投放消耗', {
      kpis: [metric('消耗', formatYuan(cost.total_spend_cny), spendDelta.text, spendDelta.color)],
      notice: '腾讯广告实时消耗，不落库',
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

  sectionRoi(roi) {
    if (!roi || roi.ok === false) return null
    const summary = roi.summary || {}
    const rows = (roi.rows || []).slice(-30)
    return blank('成熟样本回本', {
      notice: '近 30 天里第3天已出数的样本。未成熟的点会断开',
      kpis: [
        metric('消耗', formatYuan(summary.total_spend_cny)),
        metric('新增', formatNum(summary.total_game_new_users)),
        metric('单个新增成本', formatYuan(summary.avg_cpi_cny)),
        metric('首日回本', formatRate(summary.d0_roi)),
      ],
      chart: chartFrom(rows, 'date_key', [
        { key: 'd0_roi', name: '首日' },
        { key: 'd3_roi', name: '3日' },
        { key: 'd7_roi', name: '7日' },
      ], 'rate'),
    })
  },

  sectionErrors(errors) {
    if (!errors || errors.ok === false || !errors.errors || !errors.errors.length) return null
    return blank(`广告错误 ${formatNum(errors.total_errors)}`, {
      lines: errors.errors.slice(0, 8).map((row) => `${row.scene || '-'} · ${row.err_code || '-'} · ${formatNum(row.count)} · ${row.err_msg || ''}`),
    })
  },

})
