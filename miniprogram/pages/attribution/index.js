const api = require('../../utils/api')
const filterStore = require('../../utils/filter')
const { dateKey, addDays } = require('../../utils/window')
const { present } = require('../../utils/present')
const session = require('../../utils/session')

Page({
  data: {
    loading: true,
    refreshing: false,
    error: '',
    sections: [],
    fromDate: '',
    toDate: '',
    busy: false,
  },

  onLoad() {
    const end = addDays(dateKey(Date.now()), -1)
    this._from = addDays(end, -29)
    this._to = end
    this.setData({ fromDate: this._from, toDate: this._to })
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

  load() {
    const seq = (this._seq || 0) + 1
    this._seq = seq
    const current = filterStore.read()
    const key = ['attr', current.gameKey, current.platform, this._from, this._to].join(':')
    session.showCached(this, key, ['sections'])
    return api.get('/api/realtime/attribution', {
      game: current.gameKey,
      platform: current.platform,
      from_date: this._from,
      to_date: this._to,
    }).then((data) => {
      if (seq !== this._seq) return
      if (!data || data.ok === false) throw new Error((data && data.error) || '归因加载失败')
      session.settle(this, key, { sections: present('归因', data) })
    }).catch((error) => {
      if (seq !== this._seq) return
      session.fail(this, error)
    })
  },

  onRecompute() {
    if (this.data.busy) return
    const current = filterStore.read()
    this.setData({ busy: true })
    wx.showLoading({ title: '回算中', mask: false })
    api.post('/api/realtime/recompute-attribution', {
      game: current.gameKey,
      from_date: this._from,
      to_date: this._to,
    }).then((data) => {
      wx.hideLoading()
      if (!data || data.ok === false) throw new Error((data && data.error) || '回算失败')
      wx.showToast({ title: '已回算', icon: 'success' })
      this.load()
    }).catch((error) => {
      wx.hideLoading()
      wx.showModal({ title: '回算失败', content: error.message || '请求失败', showCancel: false })
    }).finally(() => this.setData({ busy: false }))
  },
})
