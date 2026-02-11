// 小孩存钱宝 - 应用入口
App({
  globalData: {
    env: 'cloud1-1gl9y1l7f00779ab', // 请填入云环境 ID
    userInfo: null,
    isLoggedIn: false
  },

  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true
    })

    // 初始化数据库集合（首次使用时自动创建）
    this.initDB()

    // 尝试获取用户信息
    this.checkLogin()
  },

  // 初始化数据库集合
  initDB: function () {
    wx.cloud.callFunction({
      name: 'babySaver',
      data: { type: 'initCollections' }
    }).then(res => {
      console.log('数据库集合初始化:', res.result)
    }).catch(err => {
      console.error('数据库初始化失败:', err)
    })
  },

  // 检查登录状态
  checkLogin: function () {
    return new Promise((resolve) => {
      wx.cloud.callFunction({
        name: 'babySaver',
        data: { type: 'getUserInfo' }
      }).then(res => {
        const result = res.result
        if (result.code === 0 && result.data) {
          this.globalData.userInfo = result.data
          this.globalData.isLoggedIn = true
          // 通知页面登录状态已更新
          if (this.loginCallback) {
            this.loginCallback(result.data)
          }
        }
        resolve(result)
      }).catch(err => {
        console.error('检查登录失败:', err)
        resolve({ code: -1 })
      })
    })
  }
})
