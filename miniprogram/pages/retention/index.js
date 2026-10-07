const api = require('../../utils/api')
const filterStore = require('../../utils/filter')
const { dateKey, addDays } = require('../../utils/window')
const { blank, chartFrom } = require('../../utils/present')
const session = require('../../utils/session')

const SEGMENTS = [
  { key: '整体', label: '整体' },
  { key: 'iOS', label: '苹果手机' },
  { key: 'Android', label: '安卓手机' },
  { key: 'HarmonyOS', label: '鸿蒙' },
  { key: 'iPad', label: '苹果平板' },
  { key: 'Android Pad', label: '安卓平板' },
  { key: 'Unknown', label: '未知' },
]

function pointRate(segment, day) {
  const point = (segment.points || []).find((item) => item.age_day === day)
  if (!point || !point.is_complete_day || point.retention_rate === null || point.retention_rate === undefined) return null
  return point.retention_rate
}

Page({
  data: {
    loading: true,
    refreshing: false,
    error: '',
    sections: [],
    segments: SEGMENTS,
    segment: '整体',
    fromDate: '',
    toDate: '',
  },

  onLoad() {
    const end = addDays(dateKey(Date.now()), -1)
    this._from = addDays(end, -13)
    this._to = end
    this.setData({ toDate: this._to, fromDate: this._from })
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

  onSegment(event) {
    this.setData({ segment: event.currentTarget.dataset.v })
    if (this._data) this.render(this._data)
  },

  onFrom(event) {
    this._from = event.detail.value
    this.setData({ fromDate: this._from })
    this.load()
  },

  onTo(event) {
    this._to = event.detail.value
    this.setData({ toDate: this._to })
    this.load()
  },

  render(data) {
    const segmentName = this.data.segment
    const rows = (data.cohorts || []).map((cohort) => {
      const segment = segmentName === '整体'
        ? cohort.overall
        : (cohort.devices || []).find((item) => item.device_type === segmentName) || { cohort_size: 0, points: [] }
      return {
        cohort_date: cohort.cohort_date,
        d1: pointRate(segment, 1),
        d3: pointRate(segment, 3),
        d7: pointRate(segment, 7),
        d14: pointRate(segment, 14),
        d30: pointRate(segment, 30),
      }
    })
    const sections = [blank(`${segmentName}留存`, {
      notice: data.notice || `${data.from_date || this.data.fromDate} 至 ${data.to_date || this.data.toDate} · 未成熟的天数会断开`,
      chart: chartFrom(rows, 'cohort_date', [
        { key: 'd1', name: '次日', color: '#1F4B99' },
        { key: 'd3', name: '3日', color: '#078A4D' },
        { key: 'd7', name: '7日', color: '#E11D48' },
        { key: 'd14', name: '14日', color: '#B45309' },
        { key: 'd30', name: '30日', color: '#0E8F98' },
      ], 'rate'),
    })]
    this.setData({ sections, loading: false, refreshing: false, error: '' })
    if (this._key) session.save(this._key, { sections })
  },

  load() {
    const seq = (this._seq || 0) + 1
    this._seq = seq
    const current = filterStore.read()
    this._key = ['ret', current.gameKey, current.platform, this._from, this._to].join(':')
    session.showCached(this, this._key, ['sections'])
    return api.get('/api/realtime/retention-cohorts', {
      game: current.gameKey,
      platform: current.platform,
      from_date: this._from,
      to_date: this._to,
      max_age: 30,
    }).then((data) => {
      if (seq !== this._seq) return
      if (!data || data.ok === false) throw new Error((data && data.error) || '留存加载失败')
      this._data = data
      this.render(data)
    }).catch((error) => {
      if (seq !== this._seq) return
      session.fail(this, error)
    })
  },
})
