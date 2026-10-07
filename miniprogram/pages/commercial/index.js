const api = require('../../utils/api')
const filterStore = require('../../utils/filter')
const { formatNum, formatYuan, formatRate } = require('../../utils/format')
const { windowQuery, dateRangeQuery, dateKey, addDays } = require('../../utils/window')
const { blank, present, chartFrom } = require('../../utils/present')
const session = require('../../utils/session')

function safe(promise) {
  return promise.catch((error) => ({ ok: false, error: error.message || String(error) }))
}

function yesterday() {
  return addDays(dateKey(Date.now()), -1)
}

Page({
  data: {
    loading: true,
    refreshing: false,
    error: '',
    sections: [],
    busy: false,
    maturity: 3,
    form: {
      date_key: '',
      spend_cny: '',
      wechat_ad_revenue_cny: '',
      douyin_ad_revenue_cny: '',
      wechat_ad_impressions: '',
      wechat_clicks: '',
      note: '',
    },
  },

  onLoad() {
    this._form = Object.assign({}, this.data.form, { date_key: yesterday() })
    this.setData({ form: this._form })
  },

  onShow() {
    this.load()
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  onFilter() {
    this.load()
  },

  onMaturity(event) {
    this._maturity = Number(event.currentTarget.dataset.v)
    this.setData({ maturity: this._maturity })
    this.load()
  },

  onForm(event) {
    const key = event.currentTarget.dataset.k
    this._form = Object.assign({}, this._form || this.data.form, { [key]: event.detail.value })
    this.setData({ form: this._form })
  },

  load() {
    const seq = (this._seq || 0) + 1
    this._seq = seq
    const current = filterStore.read()
    const base = { game: current.gameKey, platform: current.platform }
    const dates = dateRangeQuery(current.windowKey)
    const target = dateKey(Date.now())
    const maturity = this._maturity || this.data.maturity
    const key = ['biz', current.gameKey, current.platform, current.windowKey, maturity].join(':')
    this._slots = {}
    if (this._ai) this._slots.ai = present('智能分析', this._ai)
    session.showCached(this, key, ['sections'])
    const paint = (id, list) => {
      if (seq !== this._seq) return
      this._slots[id] = list
      const sections = []
      ;['decision', 'money', 'ltv', 'roi', 'acq', 'ai'].forEach((name) => {
        if (this._slots[name]) sections.push(...this._slots[name])
      })
      this._latest = sections
      this.setData({ sections, loading: false, refreshing: true, error: '' })
    }
    const tasks = [
      safe(api.get('/api/realtime/business-roi-decision', Object.assign({}, base, {
        target_date: target,
        maturity_day: maturity,
        baseline_days: 7,
      }))).then((decision) => paint('decision', this.partDecision(decision))),
      safe(api.get('/api/realtime/monetization', Object.assign({}, base, dates, windowQuery(current.windowKey))))
        .then((money) => paint('money', this.partMoney(money))),
      safe(api.get('/api/realtime/ltv', Object.assign({}, base, dates, windowQuery(current.windowKey))))
        .then((ltv) => paint('ltv', this.partLtv(ltv))),
      safe(api.get('/api/realtime/business-inputs', Object.assign({}, base, dates)))
        .then((roi) => paint('roi', this.partRoi(roi))),
      safe(api.get('/api/realtime/acquisition-intelligence', Object.assign({}, base, dates)))
        .then((acq) => paint('acq', this.partAcq(acq))),
    ]
    return Promise.all(tasks).then(() => {
      if (seq !== this._seq) return
      session.settle(this, key, { sections: this._latest || [] })
    })
  },

  partDecision(decision) {
    if (decision && decision.ok !== false) return present('投放决策', decision)
    if (decision && decision.error) return [blank('投放决策', { error: decision.error })]
    return []
  },

  partMoney(money) {
    if (!money || money.ok === false) return []
    const view = Object.assign({}, money)
    delete view.ltv
    return present('变现', view)
  },

  partLtv(ltv) {
    if (!ltv || ltv.ok === false) return []
    const cohorts = (ltv.cohorts || []).slice(-14).map((row) => ({
      cohort_date: row.cohort_date,
      d0: row.ltv && row.ltv.d0,
      d1: row.ltv && row.ltv.d1,
      d3: row.ltv && row.ltv.d3,
      d7: row.ltv && row.ltv.d7,
      d30: row.ltv && row.ltv.d30,
    }))
    return present('用户价值', { ok: true, notice: ltv.notice, summary: ltv.summary }).concat(blank('同期用户价值', {
      chart: chartFrom(cohorts, 'cohort_date', [
        { key: 'd0', name: '首日' },
        { key: 'd1', name: '次日' },
        { key: 'd3', name: '3日' },
        { key: 'd7', name: '7日' },
        { key: 'd30', name: '30日' },
      ], 'yuan'),
    }))
  },

  partRoi(roi) {
    if (!roi || roi.ok === false) return []
    const summary = roi.summary || {}
    const rows = (roi.rows || []).slice(-30)
    return [blank('真实录入', {
      kpis: [
        { label: '消耗', value: formatYuan(summary.total_spend_cny), sub: '', subColor: '' },
        { label: '微信收入', value: formatYuan(summary.total_wechat_revenue_cny), sub: '', subColor: '' },
        { label: '新增', value: formatNum(summary.total_game_new_users), sub: '', subColor: '' },
        { label: '单个新增成本', value: formatYuan(summary.avg_cpi_cny), sub: '', subColor: '' },
        { label: '首日回本', value: formatRate(summary.d0_roi), sub: '', subColor: '' },
        { label: '首日毛利', value: formatYuan(summary.total_d0_margin_cny), sub: '', subColor: '' },
      ],
      chart: chartFrom(rows, 'date_key', [
        { key: 'spend_cny', name: '消耗', color: '#B45309' },
        { key: 'wechat_ad_revenue_cny', name: '微信', color: '#078A4D' },
        { key: 'douyin_ad_revenue_cny', name: '抖音', color: '#E11D48' },
      ], 'yuan'),
      cards: rows.slice().reverse().slice(0, 8).map((row) => ({
        id: row.date_key,
        title: row.date_key,
        extra: '删除',
        meta: `消耗 ${formatYuan(row.spend_cny)} · 微信收入 ${formatYuan(row.wechat_ad_revenue_cny)} · 抖音 ${formatYuan(row.douyin_ad_revenue_cny)}`,
        lines: [
          `新增 ${formatNum(row.game_new_users)} · 单个新增成本 ${formatYuan(row.cpi_cny)} · 首日回本 ${formatRate(row.d0_roi)} · 7日回本 ${formatRate(row.d7_roi)}`,
          row.data_status_label || row.note || '',
        ],
      })),
    })]
  },

  partAcq(acq) {
    if (!acq || acq.ok === false) return []
    return present('投放洞察', acq)
  },

  async run(title, job, reload) {
    if (this.data.busy) return null
    this.setData({ busy: true })
    wx.showLoading({ title, mask: false })
    try {
      const data = await job()
      wx.hideLoading()
      if (!data || data.ok === false) throw new Error((data && (data.error || data.code)) || '失败')
      wx.showToast({ title: '完成', icon: 'success' })
      if (reload) await this.load()
      return data
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '没有完成', content: error.message || '请求失败', showCancel: false })
      return null
    } finally {
      this.setData({ busy: false })
    }
  },

  onAi() {
    const current = filterStore.read()
    this.run('分析中', () => api.post('/api/realtime/business-roi-ai-analysis', {
      game: current.gameKey,
      platform: current.platform,
      baseline_days: 7,
      maturity_day: this._maturity || this.data.maturity,
    }), false).then((data) => {
      if (!data) return
      this._ai = data
      this.load()
    })
  },

  onPull(event) {
    const kind = event.currentTarget.dataset.kind
    const current = filterStore.read()
    const dates = dateRangeQuery(current.windowKey)
    const path = {
      ads: '/api/realtime/tencent-ads/ingest-business-inputs',
      insight: '/api/realtime/tencent-ads/ingest-insights',
      wx: '/api/realtime/wechat-publisher/ingest-business-inputs',
      dy: '/api/realtime/douyin-publisher/ingest-business-inputs',
    }[kind]
    this.run('同步中', () => api.post(path, Object.assign({ game: current.gameKey }, dates)), true)
  },

  onSave() {
    const current = filterStore.read()
    const form = this._form || this.data.form
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date_key || '')) {
      wx.showToast({ title: '日期格式应为 YYYY-MM-DD', icon: 'none' })
      return
    }
    this.run('保存中', () => api.post('/api/realtime/business-inputs', {
      game: current.gameKey,
      date_key: form.date_key,
      spend_cny: Number(form.spend_cny) || 0,
      wechat_clicks: Number(form.wechat_clicks) || 0,
      wechat_ad_revenue_cny: Number(form.wechat_ad_revenue_cny) || 0,
      wechat_ad_impressions: Number(form.wechat_ad_impressions) || 0,
      douyin_ad_revenue_cny: Number(form.douyin_ad_revenue_cny) || 0,
      note: form.note || '',
    }), true)
  },

  onCard(event) {
    const dateKeyValue = event.detail.id
    if (!dateKeyValue) return
    const current = filterStore.read()
    wx.showModal({
      title: '删除这天的录入？',
      content: dateKeyValue,
      success: (res) => {
        if (!res.confirm) return
        this.run('删除中', () => api.del('/api/realtime/business-inputs', {
          game: current.gameKey,
          date_key: dateKeyValue,
        }), true)
      },
    })
  },
})
