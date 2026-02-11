// 登录注册页（仅未注册用户可见，已注册用户自动跳转）
const api = require('../../utils/api')

Page({
  data: {
    nickName: '',
    role: '', // 'parent' 或 'child'
    loading: false
  },

  onShow() {
    // 已注册用户（微信号已绑定）直接进入，不再显示注册页
    this.checkAlreadyRegistered()
  },

  // 检查是否已注册：已注册则用该身份自动登录并跳转
  async checkAlreadyRegistered() {
    try {
      const res = await api.callCloud('getUserInfo')
      if (res.code === 0 && res.data) {
        const app = getApp()
        app.globalData.userInfo = res.data
        app.globalData.isLoggedIn = true
        wx.switchTab({ url: '/pages/index/index' })
      }
    } catch (e) {
      // 未注册或网络异常，继续显示注册表单
    }
  },

  // 输入昵称
  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value.trim() })
  },

  // 选择角色
  onSelectRole(e) {
    this.setData({ role: e.currentTarget.dataset.role })
  },

  // 提交注册
  async onRegister() {
    const { nickName, role } = this.data
    if (!nickName) {
      return api.showToast('请输入昵称')
    }
    if (!role) {
      return api.showToast('请选择身份')
    }

    this.setData({ loading: true })
    api.showLoading('注册中...')

    try {
      const res = await api.callCloud('register', { nickName, role })
      api.hideLoading()
      api.showToast('注册成功')

      // 更新全局用户信息（与当前微信号绑定）
      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      app.globalData.userInfo = userRes.data
      app.globalData.isLoggedIn = true

      // 跳转到家庭管理页
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/family/index' })
      }, 800)
    } catch (err) {
      api.hideLoading()
      // 已注册：该微信号已绑定身份，直接登录并跳转
      if (err.msg === '用户已注册') {
        const app = getApp()
        api.callCloud('getUserInfo').then(userRes => {
          if (userRes.data) {
            app.globalData.userInfo = userRes.data
            app.globalData.isLoggedIn = true
            wx.switchTab({ url: '/pages/index/index' })
          } else {
            api.showError('用户已注册')
          }
        }).catch(() => api.showError('用户已注册'))
      } else {
        api.showError(err.msg || '注册失败')
      }
    } finally {
      this.setData({ loading: false })
    }
  }
})
