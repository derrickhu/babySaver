const api = require('../../utils/api')
const filterStore = require('../../utils/filter')
const { SNAPSHOT_GAMES, findGame } = require('../../utils/games')
const { blank, present, label, formatValue } = require('../../utils/present')
const session = require('../../utils/session')

const PREFER = ['user_id', 'level', 'star', 'huayuan', 'diamond', 'coins', 'bowl_level', 'tower_floor', 'max_floor', 'clears', 'clear_count', 'tutorial_completed', 'last_active_at']

Page({
  data: {
    loading: true,
    refreshing: false,
    error: '',
    sections: [],
    keyword: '',
    supported: true,
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

  onKeyword(event) {
    this._keyword = event.detail.value
    this.setData({ keyword: this._keyword })
  },

  onSearch() {
    this.load()
  },

  load() {
    const seq = (this._seq || 0) + 1
    this._seq = seq
    const current = filterStore.read()
    if (!SNAPSHOT_GAMES.includes(current.gameKey)) {
      this.setData({
        loading: false,
        supported: false,
        error: '',
        sections: [blank(findGame(current.gameKey).displayName, { notice: '玩家档案目前有花花妙屋、别捞水果、灵宠消消塔。' })],
      })
      return Promise.resolve()
    }
    const key = ['snap', current.gameKey, current.platform, this._keyword || ''].join(':')
    session.showCached(this, key, ['sections'])
    this.setData({ supported: true })
    const query = { game: current.gameKey, platform: current.platform }
    return Promise.all([
      api.get('/api/realtime/huahua-snapshot', query),
      api.get('/api/realtime/huahua-snapshot/players', Object.assign({
        page: 1,
        pageSize: 20,
        order: 'desc',
        q: this._keyword || '',
      }, query)),
    ]).then(([overview, players]) => {
      if (seq !== this._seq) return
      if (!overview || overview.ok === false) throw new Error((overview && overview.error) || '档案加载失败')
      const sections = present('玩家档案', overview)
      const items = (players && players.items) || []
      sections.push(this.playerSection(items, players && players.total))
      session.settle(this, key, { sections })
    }).catch((error) => {
      if (seq !== this._seq) return
      session.fail(this, error)
    })
  },

  playerSection(items, total) {
    if (!items.length) return blank('玩家明细', { notice: '没有匹配的玩家' })
    const keys = Object.keys(items[0])
    const cols = PREFER.filter((key) => keys.includes(key)).slice(0, 5)
    keys.forEach((key) => {
      if (cols.length >= 5) return
      if (!cols.includes(key) && items[0][key] !== null && typeof items[0][key] !== 'object') cols.push(key)
    })
    return blank(`玩家明细 ${total || items.length}`, {
      cards: items.slice(0, 12).map((item) => ({
        title: String(item.user_id || item.anonymous_id || '玩家'),
        meta: '',
        lines: cols.map((key) => `${label(key)} ${formatValue(key, item[key])}`),
      })),
    })
  },

  onPullNow() {
    const current = filterStore.read()
    if (!SNAPSHOT_GAMES.includes(current.gameKey)) return
    wx.showLoading({ title: '拉取中', mask: false })
    api.post('/api/realtime/snapshot-now', {
      game: current.gameKey,
      platform: current.platform,
    }).then((data) => {
      wx.hideLoading()
      if (!data || data.ok === false) throw new Error((data && data.error) || '拉取失败')
      wx.showToast({ title: '已触发', icon: 'success' })
      this.load()
    }).catch((error) => {
      wx.hideLoading()
      wx.showModal({ title: '拉取失败', content: error.message || '请求失败', showCancel: false })
    })
  },
})
