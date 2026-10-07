const api = require('../../utils/api')
const filterStore = require('../../utils/filter')
const { formatNum, formatTime } = require('../../utils/format')
const { blank, phrase } = require('../../utils/present')
const session = require('../../utils/session')

Page({
  data: { loading: true, refreshing: false, error: '', sections: [], busy: false },

  onShow() {
    this.load()
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  load() {
    const seq = (this._seq || 0) + 1
    this._seq = seq
    session.showCached(this, 'ops', ['sections'])
    const healthP = api.get('/api/realtime/health')
    const cleanupP = api.get('/api/realtime/cleanup-history', { limit: 8 }).catch(() => ({ runs: [] }))
    const healthDone = healthP.then((health) => {
      if (seq !== this._seq) return null
      if (!health || health.ok === false) throw new Error((health && health.error) || '运维数据加载失败')
      const stats = health.stats || {}
      const sections = [
        blank('事件库', {
          kpis: [
            { label: '总量', value: formatNum(stats.totalEvents), sub: '', subColor: '' },
            { label: '近24小时', value: formatNum(stats.last24hEvents), sub: '', subColor: '' },
            { label: '最早', value: formatTime(stats.oldestEventTs), sub: '', subColor: '' },
            { label: '最新', value: formatTime(stats.newestEventTs), sub: '', subColor: '' },
          ],
          lines: (health.games || []).map((game) => game.display_name || phrase(game.game_key)),
        }),
        blank('最近拉取', {
          lines: (health.recent_runs || []).slice(0, 8).map((row) => [
            phrase(row.game_key),
            phrase(row.status),
            `拉取 ${formatNum(row.fetched)}`,
            formatTime(row.finished_at),
            row.error_message || '',
          ].filter(Boolean).join(' · ')),
        }),
      ]
      this.setData({ sections, loading: false, refreshing: true, error: '' })
      return sections
    })
    return Promise.all([healthDone, cleanupP]).then(([sections, cleanup]) => {
      if (seq !== this._seq || !sections) return
      sections.push(blank('清理记录', {
        notice: '只清理事件明细。本地保留 90 天，云端保留 7 天。',
        lines: ((cleanup && cleanup.runs) || []).slice(0, 8).map((row) => [
          phrase(row.status),
          phrase(row.trigger_source),
          `本地 ${formatNum(row.local_deleted)}`,
          `云端 ${formatNum(row.cloud_deleted)}`,
          formatTime(row.finished_at),
        ].join(' · ')),
      }))
      session.settle(this, 'ops', { sections })
    }).catch((error) => {
      if (seq !== this._seq) return
      session.fail(this, error)
    })
  },

  run(title, job) {
    if (this.data.busy) return
    this.setData({ busy: true })
    wx.showLoading({ title, mask: false })
    job().then((data) => {
      wx.hideLoading()
      if (!data || data.ok === false) throw new Error((data && (data.error || data.code)) || '失败')
      const summary = data.fetched != null
        ? `拉取 ${data.fetched}，入库 ${data.inserted || 0}`
        : data.localDeleted != null
          ? `本地 ${data.localDeleted}，云端 ${data.cloudDeleted}`
          : '已完成'
      wx.showModal({ title: '完成', content: summary, showCancel: false })
      this.load()
    }).catch((error) => {
      wx.hideLoading()
      wx.showModal({ title: '没有完成', content: error.message || '请求失败', showCancel: false })
    }).finally(() => this.setData({ busy: false }))
  },

  onIngest() {
    const current = filterStore.read()
    this.run('拉取中', () => api.post('/api/realtime/ingest-now', { game: current.gameKey }))
  },

  onBuckets() {
    const current = filterStore.read()
    this.run('重算中', () => api.post('/api/realtime/recompute-buckets', { game: current.gameKey, window_hours: 24 }))
  },

  onLtv() {
    const current = filterStore.read()
    this.run('重算中', () => api.post('/api/realtime/recompute-ltv', { game: current.gameKey }))
  },

  onPass() {
    this.run('重算中', () => api.post('/api/realtime/recompute-level-pass-rates', { game: 'hotpot', window_days: 30, publish: true }))
  },

  onDry() {
    this.run('预演中', () => api.post('/api/realtime/cleanup-now', { dry_run: true }))
  },

  onClean() {
    wx.showModal({
      title: '清理过期事件？',
      content: '会删除本地 90 天前、云端 7 天前的事件明细。玩家存档不会动。',
      confirmColor: '#B91C1C',
      success: (res) => {
        if (!res.confirm) return
        this.run('清理中', () => api.post('/api/realtime/cleanup-now', { dry_run: false }))
      },
    })
  },
})
