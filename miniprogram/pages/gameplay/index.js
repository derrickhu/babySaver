const api = require('../../utils/api')
const auth = require('../../utils/auth')
const filterStore = require('../../utils/filter')
const { findGame, PANELS } = require('../../utils/games')
const { windowQuery } = require('../../utils/window')
const { blank, present } = require('../../utils/present')
const session = require('../../utils/session')

Page({
  data: { loading: true, refreshing: false, error: '', sections: [] },

  onShow() {
    auth.selectTab(this, 2)
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
    const panels = (game.panels || []).map((id) => PANELS[id]).filter(Boolean)
    const key = ['play', current.gameKey, current.platform, current.windowKey].join(':')
    if (!panels.length) {
      const sections = [blank(game.displayName, { notice: '这款游戏还没有玩法分析' })]
      this.setData({ loading: false, refreshing: false, error: '', sections })
      return Promise.resolve()
    }
    this._slot = []
    session.showCached(this, key, ['sections'])
    const query = Object.assign({ game: current.gameKey, platform: current.platform }, windowQuery(current.windowKey))
    const jobs = panels.map((panel, index) => api.get(panel.path, query).then(async (data) => {
      const sections = present(panel.title, data)
      if (panel.path === '/api/realtime/level-progress' && current.gameKey === 'hotpot') {
        const pass = await api.get('/api/realtime/level-pass-rates', {
          game: 'hotpot',
          window_days: 30,
          platform: current.platform,
        }).catch(() => null)
        if (pass && pass.ok !== false) sections.push(...present('近 30 天通关率', pass.snapshot || pass))
      }
      return { index, sections }
    }).catch((error) => ({
      index,
      sections: [blank(panel.title, { error: error.message || '加载失败' })],
    })).then((group) => {
      if (seq !== this._seq) return
      this._slot[group.index] = group.sections
      const sections = []
      this._slot.forEach((item) => { if (item) sections.push(...item) })
      this.setData({ sections, loading: false, refreshing: true, error: '' })
    }))
    return Promise.all(jobs).then(() => {
      if (seq !== this._seq) return
      const sections = []
      this._slot.forEach((item) => { if (item) sections.push(...item) })
      session.settle(this, key, { sections })
    })
  },
})
