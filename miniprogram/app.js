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
      }).then(async res => {
        const result = res.result
        if (result.code === 0 && result.data) {
          // 将 cloud:// 头像转为临时 HTTPS URL，确保跨设备显示
          // emoji: 开头的是默认头像，清空让前端 emoji fallback 生效
          const avatarUrl = result.data.avatarUrl
          if (avatarUrl && avatarUrl.startsWith('emoji:')) {
            result.data.avatarUrl = ''
          } else if (avatarUrl && avatarUrl.startsWith('cloud://')) {
            try {
              const urlRes = await wx.cloud.getTempFileURL({ fileList: [avatarUrl] })
              const item = urlRes.fileList && urlRes.fileList[0]
              if (item && item.status === 0 && item.tempFileURL) {
                result.data.avatarUrl = item.tempFileURL
              } else {
                result.data.avatarUrl = ''
              }
            } catch (e) {
              result.data.avatarUrl = ''
            }
          }
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
