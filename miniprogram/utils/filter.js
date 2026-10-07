const { findGame } = require('./games')

const DEFAULTS = {
  gameKey: 'hotpot',
  platform: 'wechat',
  windowKey: 'today',
}

function read() {
  const app = getApp()
  const stored = app.globalData.filter || wx.getStorageSync('ga_filter') || {}
  const filter = {
    gameKey: stored.gameKey || DEFAULTS.gameKey,
    platform: stored.platform || DEFAULTS.platform,
    windowKey: stored.windowKey || DEFAULTS.windowKey,
  }
  app.globalData.filter = filter
  return filter
}

function write(partial) {
  const next = Object.assign({}, read(), partial)
  if (!findGame(next.gameKey)) next.gameKey = DEFAULTS.gameKey
  getApp().globalData.filter = next
  wx.setStorageSync('ga_filter', next)
  return next
}

module.exports = { read, write }
