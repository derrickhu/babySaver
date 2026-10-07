const api = require('../../utils/api')
const auth = require('../../utils/auth')
const filterStore = require('../../utils/filter')
const { drawTrend, nearest } = require('../../utils/curve')
const { formatNum, formatYuan } = require('../../utils/format')
const session = require('../../utils/session')

const ICONS = {
  hotpot: '/images/games/hotpot.png',
  huahua: '/images/games/huahua.png',
  caizhu: '/images/games/caizhu.png',
  petTower: '/images/games/petTower.png',
  wujin_wenzhang: '/images/games/wujin_wenzhang.png',
  cunkou: '/images/games/cunkou.png',
  jiancai: '/images/games/jiancai.png',
  blackrosa: '/images/games/blackrosa.png',
}

const COLORS = {
  total: '#1F4B99',
  wechat: '#078A4D',
  douyin: '#E11D48',
}

function dayLabel(value) {
  const parts = String(value || '').split('-')
  if (parts.length < 3) return value
  return `${Number(parts[1])}/${Number(parts[2])}`
}

function dayLong(value) {
  const parts = String(value || '').split('-')
  if (parts.length < 3) return value
  return `${Number(parts[1])}月${Number(parts[2])}日`
}

function monthLabel(value) {
  const parts = String(value || '').split('-')
  if (parts.length < 2) return value
  return `${parts[0].slice(2)}年${Number(parts[1])}月`
}

function monthLong(value) {
  const parts = String(value || '').split('-')
  if (parts.length < 2) return value
  return `${parts[0]}年${Number(parts[1])}月`
}

function pickAt(values, indexes) {
  return indexes.map((index) => (values || [])[index] || 0)
}

function pickGames(games, indexes) {
  return (games || []).map((game) => ({
    game_key: game.game_key,
    display_name: game.display_name,
    revenue: pickAt(game.revenue, indexes),
  }))
}

function sliceDaily(daily, indexes) {
  const days = (daily && daily.days) || []
  return {
    days: indexes.map((index) => days[index]),
    total: pickAt(daily && daily.total, indexes),
    games: pickGames(daily && daily.games, indexes),
    wechat: {
      total: pickAt(daily && daily.wechat && daily.wechat.total, indexes),
      games: pickGames(daily && daily.wechat && daily.wechat.games, indexes),
    },
    douyin: {
      total: pickAt(daily && daily.douyin && daily.douyin.total, indexes),
      games: pickGames(daily && daily.douyin && daily.douyin.games, indexes),
    },
  }
}

function trendSource(data, grain) {
  if (grain === 'year') return { source: data.monthly_trend, byMonth: true }
  const daily = data.daily_trend
  if (grain === 'month30') return { source: daily, byMonth: false }
  const days = (daily && daily.days) || []
  const monthKey = String(data.month_from_date || '').slice(0, 7)
  const indexes = []
  days.forEach((day, index) => {
    if (monthKey && String(day).slice(0, 7) === monthKey) indexes.push(index)
  })
  return { source: sliceDaily(daily, indexes), byMonth: false }
}

function seriesBundle(data, channel, grain) {
  const empty = {
    buckets: [], labels: [], longLabels: [], primary: [], total: [], wechat: [], douyin: [],
    games: [], wechatGames: [], douyinGames: [], byMonth: false,
  }
  const picked = trendSource(data, grain)
  const source = picked.source
  if (!source) return empty
  const byMonth = picked.byMonth
  const buckets = (byMonth ? source.months : source.days) || []
  const total = source.total || []
  const wechat = (source.wechat && source.wechat.total) || []
  const douyin = (source.douyin && source.douyin.total) || []
  const wechatGames = (source.wechat && source.wechat.games) || []
  const douyinGames = (source.douyin && source.douyin.games) || []
  const games = channel === 'wechat' ? wechatGames : channel === 'douyin' ? douyinGames : (source.games || [])
  const primary = channel === 'wechat' ? wechat : channel === 'douyin' ? douyin : total
  return {
    buckets,
    labels: buckets.map((bucket) => (byMonth ? monthLabel(bucket) : dayLabel(bucket))),
    longLabels: buckets.map((bucket) => (byMonth ? monthLong(bucket) : dayLong(bucket))),
    primary,
    total,
    wechat,
    douyin,
    games,
    wechatGames,
    douyinGames,
    byMonth,
  }
}

function findRevenue(games, gameKey) {
  const found = (games || []).find((item) => item.game_key === gameKey)
  return (found && found.revenue) || []
}

const RANGE_NAME = { mtd: '当月', month30: '近一月', year: '近一年' }

function endNote(values, byMonth) {
  if (!values || values.length < 2) return { text: '', up: true }
  const curr = Number(values[values.length - 1]) || 0
  const prev = Number(values[values.length - 2]) || 0
  const word = byMonth ? '较上月' : '较前一日'
  if (!prev) return { text: `最新 ¥${formatYuan(curr)}`, up: curr >= 0 }
  const pct = ((curr - prev) / prev) * 100
  const sign = pct > 0 ? '+' : ''
  return {
    text: `最新 ¥${formatYuan(curr)} · ${word} ${sign}${pct.toFixed(1)}%`,
    up: pct >= 0,
  }
}

function sum(values) {
  return (values || []).reduce((total, value) => total + (Number(value) || 0), 0)
}

function leadPlatform(platforms) {
  let best = platforms[0]
  platforms.forEach((item) => {
    if (!best || item.dau > best.dau) best = item
  })
  return (best && best.platform) || 'wechat'
}

Page({
  data: {
    loading: true,
    refreshing: false,
    error: '',
    empty: false,
    pinned: false,
    heroLabel: '当月收入',
    heroValue: '-',
    heroWx: '-',
    heroDy: '-',
    trendNote: '',
    trendUp: true,
    channel: 'total',
    grain: 'mtd',
    chartTitle: '当月收入',
    scrubHint: '按住曲线看单日',
    rangeText: '-',
    sparkColor: COLORS.total,
    tip: { show: false, left: 0, top: 0, date: '', value: '' },
    labels: [],
    sparkKey: '',
    sparkIndex: -1,
    games: [],
  },

  onShow() {
    auth.selectTab(this, 0)
    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    this.load()
  },

  onShareAppMessage() {
    const value = this.data.heroValue
    return {
      title: value && value !== '-' ? `经分 ¥${value}` : '经分',
      path: '/pages/home/index',
    }
  },

  onShareTimeline() {
    const value = this.data.heroValue
    return { title: value && value !== '-' ? `经分 ¥${value}` : '经分' }
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  onChannel(event) {
    this._channel = event.currentTarget.dataset.v
    this.refreshView()
  },

  onGrain(event) {
    const next = event.currentTarget.dataset.v
    if (!next || next === this._grain) return
    this._grain = next
    this._active = null
    this._sparkKey = ''
    this._sparkIndex = -1
    this.refreshView()
  },

  onHold() {},

  onBlank() {
    if (this._pickedAt && Date.now() - this._pickedAt < 350) return
    if (this._active == null && !this._sparkKey) return
    this._active = null
    this._sparkKey = ''
    this._sparkIndex = -1
    this.refreshView()
  },

  onScrub(event) {
    const touch = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0])
    if (!touch || !this._plot || !this._plot.xs.length || typeof touch.x !== 'number') return
    const index = nearest(this._plot.xs, touch.x)
    const y = this._plot.ys[index]
    const hit = y != null && Math.abs(touch.y - y) <= 46
    if (event.type === 'touchstart') this._tracking = hit
    if (!this._tracking) {
      if (event.type === 'touchstart') this.onBlank()
      return
    }
    this._pickedAt = Date.now()
    if (index === this._active && !this._sparkKey) return
    this._active = index
    this._sparkKey = ''
    this._sparkIndex = -1
    try { wx.vibrateShort({ type: 'light' }) } catch (error) { /* 模拟器可能没有振动 */ }
    this.setData(Object.assign({
      pinned: true,
      trendNote: '',
      sparkKey: '',
      sparkIndex: -1,
    }, this.pointHero(this._bundle, index, this._channel || 'total')))
    this.drawChart()
  },

  onSpark(event) {
    const key = event.currentTarget.dataset.key
    const index = event.detail.index
    if (key == null || index == null) return
    if (this._sparkKey === key && this._sparkIndex === index && this._active == null) return
    this._pickedAt = Date.now()
    const wasPinned = this._active != null
    this._active = null
    this._sparkKey = key
    this._sparkIndex = index
    const data = this._raw
    const bundle = this._bundle
    const note = bundle ? endNote(bundle.primary, bundle.byMonth) : { text: '', up: true }
    const patch = { sparkKey: key, sparkIndex: index, pinned: false, tip: { show: false, left: 0, top: 0, date: '', value: '' } }
    if (wasPinned && data && bundle) {
      Object.assign(patch, this.rangeHero(data, bundle, this._grain || 'mtd', this._channel || 'total'), {
        trendNote: note.text,
        trendUp: note.up,
      })
    }
    this.setData(patch, () => {
      if (wasPinned) this.drawChart()
    })
  },

  onGame(event) {
    const key = event.currentTarget.dataset.key
    const game = (this.data.games || []).find((item) => item.key === key)
    filterStore.write({
      gameKey: key,
      platform: (game && game.leadPlatform) || 'wechat',
      windowKey: 'today',
    })
    wx.switchTab({ url: '/pages/dashboard/index' })
  },

  onPlatform(event) {
    const key = event.currentTarget.dataset.key
    const platform = event.currentTarget.dataset.platform
    filterStore.write({ gameKey: key, platform, windowKey: 'today' })
    wx.switchTab({ url: '/pages/dashboard/index' })
  },

  onIconError(event) {
    const key = event.currentTarget.dataset.key
    const games = (this.data.games || []).map((item) => (
      item.key === key ? Object.assign({}, item, { icon: '' }) : item
    ))
    this.setData({ games })
  },

  refreshView() {
    const data = this._raw
    if (!data) return
    const channel = this._channel || 'total'
    const grain = this._grain || 'mtd'
    const bundle = seriesBundle(data, channel, grain)
    this._bundle = bundle
    if (!bundle.primary.length) this._active = null
    else if (this._active != null && this._active >= bundle.primary.length) this._active = bundle.primary.length - 1
    const pinned = this._active != null
    const note = endNote(bundle.primary, bundle.byMonth)
    const rangeName = RANGE_NAME[grain] || '当月'
    const hero = pinned ? this.pointHero(bundle, this._active, channel) : this.rangeHero(data, bundle, grain, channel)
    const games = (data.games || []).slice().sort((a, b) => (
      (b.total_dau || 0) - (a.total_dau || 0)
      || sum(findRevenue(bundle.games, b.game_key)) - sum(findRevenue(bundle.games, a.game_key))
    )).map((game, index) => {
      const wxRevenue = sum(findRevenue(bundle.wechatGames, game.game_key))
      const dyRevenue = sum(findRevenue(bundle.douyinGames, game.game_key))
      const platforms = (game.platforms || []).map((item) => ({
        platform: item.platform,
        label: item.label === 'TapTap' ? '塔普' : item.label,
        dau: formatNum(item.dau),
        ads: formatNum(item.ad_show_cnt),
        revenue: formatYuan(item.platform === 'wechat' ? wxRevenue : item.platform === 'douyin' ? dyRevenue : 0),
      }))
      return {
        key: game.game_key,
        name: game.display_name,
        mark: String(game.display_name || '?').slice(0, 1),
        icon: ICONS[game.game_key] || '',
        dau: formatNum(game.total_dau),
        ads: formatNum(game.total_ad_show),
        revenue: formatYuan(sum(findRevenue(bundle.games, game.game_key))),
        revLabel: rangeName,
        spark: findRevenue(bundle.games, game.game_key),
        platforms,
        leadPlatform: leadPlatform(game.platforms || []),
        delay: `${index * 40}ms`,
      }
    })
    this.setData(Object.assign({
      channel,
      grain,
      pinned,
      chartTitle: `${rangeName}收入`,
      scrubHint: bundle.byMonth ? '按住曲线看单月，点空白取消' : '按住曲线看单日，点空白取消',
      labels: bundle.labels,
      sparkKey: this._sparkKey || '',
      sparkIndex: this._sparkIndex == null ? -1 : this._sparkIndex,
      rangeText: formatYuan(sum(bundle.primary)),
      trendNote: pinned ? '' : note.text,
      trendUp: note.up,
      sparkColor: COLORS[channel] || COLORS.total,
      empty: bundle.buckets.length === 0,
      games,
      tip: pinned ? this.data.tip : { show: false, left: 0, top: 0, date: '', value: '' },
    }, hero), () => this.drawChart())
  },

  rangeHero(data, bundle, grain, channel) {
    const rangeName = RANGE_NAME[grain] || '当月'
    const scope = channel === 'wechat' ? '微信' : channel === 'douyin' ? '抖音' : ''
    const until = grain === 'mtd' && data.month_t1_date ? ` · 截至 ${data.month_t1_date}` : ''
    return {
      heroLabel: `${rangeName}${scope}收入${until}`,
      heroValue: formatYuan(sum(bundle.primary)),
      heroWx: formatYuan(sum(bundle.wechat)),
      heroDy: formatYuan(sum(bundle.douyin)),
    }
  },

  pointHero(bundle, index, channel) {
    const channelName = channel === 'wechat' ? '微信' : channel === 'douyin' ? '抖音' : '收入'
    return {
      heroLabel: `${bundle.longLabels[index] || ''} · ${channelName}`,
      heroValue: formatYuan(bundle.primary[index] || 0),
      heroWx: formatYuan(bundle.wechat[index] || 0),
      heroDy: formatYuan(bundle.douyin[index] || 0),
    }
  },

  ensureCanvas() {
    if (this._ctx && this._cssWidth) return Promise.resolve()
    return new Promise((resolve) => {
      wx.createSelectorQuery().in(this).select('#trend').fields({ node: true, size: true }).exec((res) => {
        const info = res && res[0]
        if (!info || !info.node || !info.width) {
          resolve()
          return
        }
        this._canvas = info.node
        this._ctx = info.node.getContext('2d')
        this._cssWidth = info.width
        this._cssHeight = info.height
        resolve()
      })
    })
  },

  drawChart() {
    const seq = (this._drawSeq || 0) + 1
    this._drawSeq = seq
    const bundle = this._bundle
    return this.ensureCanvas().then(() => {
      if (seq !== this._drawSeq || !this._ctx || !bundle || !this._cssWidth) return
      const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2
      this._canvas.width = Math.round(this._cssWidth * dpr)
      this._canvas.height = Math.round(this._cssHeight * dpr)
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const channel = this._channel || 'total'
      const overlays = channel === 'total'
        ? [
          { values: bundle.wechat, color: COLORS.wechat, width: 1.5 },
          { values: bundle.douyin, color: COLORS.douyin, width: 1.5 },
        ]
        : []
      this._plot = drawTrend(this._ctx, this._cssWidth, this._cssHeight, {
        primary: bundle.primary,
        overlays,
        labels: bundle.labels,
        active: this._active,
        color: COLORS[channel] || COLORS.total,
      })
      this.placeTip()
    })
  },

  placeTip() {
    if (this._active == null || !this._plot || !this._bundle) return
    const index = this._active
    const x = this._plot.xs[index]
    const y = this._plot.ys[index]
    if (x == null) return
    const tipW = 92
    const width = this._cssWidth || 300
    let left = x - tipW / 2
    left = Math.max(8, Math.min(left, width - tipW - 8))
    let top = y - 54
    if (top < 4) top = y + 16
    this.setData({
      tip: {
        show: true,
        left,
        top,
        date: this._bundle.labels[index] || '',
        value: formatYuan(this._bundle.primary[index] || 0),
      },
    })
  },

  load() {
    const seq = (this._seq || 0) + 1
    this._seq = seq
    this._channel = this._channel || 'total'
    this._grain = this._grain || 'mtd'
    const cached = !this._raw && session.take('home')
    if (cached && cached.raw) {
      this._raw = cached.raw
      this.refreshView()
    }
    this.setData(this._raw
      ? { refreshing: true, error: '' }
      : { loading: true, refreshing: true, error: '' })
    return api.get('/api/realtime/home-dau').then((data) => {
      if (seq !== this._seq) return
      if (!data || data.ok === false) throw new Error((data && data.error) || '总览加载失败')
      this._raw = data
      session.save('home', { raw: data })
      this.setData({ loading: false, refreshing: false, error: '' })
      this.refreshView()
    }).catch((error) => {
      if (seq !== this._seq) return
      this.setData({ loading: false, refreshing: false, error: this._raw ? '' : (error.message || '加载失败') })
      if (this._raw) wx.showToast({ title: (error.message || '加载失败').slice(0, 18), icon: 'none' })
    })
  },
})
