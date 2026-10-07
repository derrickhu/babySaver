const config = require('./utils/config')
const filter = require('./utils/filter')

App({
  globalData: {
    env: config.env,
    filter: null,
  },

  onLaunch() {
    this.globalData.filter = wx.getStorageSync('ga_filter') || {
      gameKey: 'hotpot',
      platform: 'wechat',
      windowKey: 'today',
    }
    filter.read()
  },

  onPageNotFound() {
    wx.switchTab({ url: '/pages/home/index' })
  },
})
