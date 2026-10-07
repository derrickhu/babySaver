const api = require('../../utils/api')
const filterStore = require('../../utils/filter')
const { formatTime } = require('../../utils/format')
const { windowQuery } = require('../../utils/window')
const session = require('../../utils/session')
const { phrase } = require('../../utils/present')

function clip(text) {
  const raw = text ? String(text) : ''
  return raw.length > 220 ? `${raw.slice(0, 220)}…` : raw
}

function clipParams(raw) {
  if (!raw) return ''
  let data = raw
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw) } catch (error) { return clip(phrase(raw)) }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return clip(phrase(data))
  const parts = Object.keys(data).slice(0, 6).map((key) => {
    const value = data[key]
    if (value && typeof value === 'object') return phrase(key)
    return `${phrase(key)} ${phrase(value)}`
  })
  return clip(parts.join(' · '))
}

function mapEvent(row) {
  return {
    id: row.event_id || `${row.event_ts}-${row.event_name}`,
    name: phrase(row.event_name),
    meta: `${formatTime(row.event_ts)} · ${phrase(row.platform)} · ${row.user_id || row.anonymous_id || '-'}`,
    device: [row.device_brand, row.device_model, row.app_version].filter(Boolean).join(' '),
    params: clipParams(row.params_json),
  }
}

Page({
  data: {
    loading: true,
    refreshing: false,
    error: '',
    names: [],
    eventName: '',
    keyword: '',
    events: [],
    total: 0,
    offset: 0,
  },

  onShow() {
    this.load(true)
  },

  onPullDownRefresh() {
    this.load(true).finally(() => wx.stopPullDownRefresh())
  },

  onFilter() {
    this._eventName = ''
    this._keyword = ''
    this.setData({ eventName: '', keyword: '' })
    this.load(true)
  },

  onName(event) {
    const name = event.currentTarget.dataset.name
    this._eventName = this._eventName === name ? '' : name
    this.setData({ eventName: this._eventName })
    this.load(true)
  },

  onKeyword(event) {
    this._keyword = event.detail.value
    this.setData({ keyword: this._keyword })
  },

  onSearch() {
    this.load(true)
  },

  onMore() {
    this.load(false)
  },

  load(reset) {
    const seq = (this._seq || 0) + 1
    this._seq = seq
    const current = filterStore.read()
    const offset = reset ? 0 : this.data.offset
    const query = Object.assign({
      game: current.gameKey,
      platform: current.platform,
      limit: 30,
      offset,
      event_name: this._eventName || '',
      user_query: this._keyword || '',
    }, windowQuery(current.windowKey))
    const key = ['evt', current.gameKey, current.platform, current.windowKey, this._eventName || '', this._keyword || ''].join(':')
    if (reset) session.showCached(this, key, ['events', 'names', 'total'])
    else this.setData({ refreshing: true, error: '' })
    const namesReq = reset
      ? api.get('/api/realtime/event-names', {
        game: current.gameKey,
        platform: current.platform,
        ...windowQuery(current.windowKey),
      }).catch(() => ({ names: [] }))
      : Promise.resolve(null)
    return Promise.all([
      api.get('/api/realtime/events', query),
      namesReq,
    ]).then(([data, names]) => {
      if (seq !== this._seq) return
      if (!data || data.ok === false) throw new Error((data && data.error) || '事件加载失败')
      const rows = (data.events || []).map(mapEvent)
      const view = {
        total: data.total || 0,
        offset: offset + rows.length,
        events: reset ? rows : this.data.events.concat(rows),
        names: names
          ? (names.names || []).slice(0, 40).map((item) => ({ name: item, label: phrase(item) }))
          : this.data.names,
      }
      this.setData(Object.assign({ loading: false, refreshing: false, error: '' }, view))
      if (reset) session.save(key, { events: view.events, names: view.names, total: view.total })
    }).catch((error) => {
      if (seq !== this._seq) return
      session.fail(this, error)
    })
  },
})
