// 登录注册页（仅未注册用户可见，已注册用户自动跳转）
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    nickName: '',
    avatarUrl: '',
    role: '', // 'parent' 或 'child'
    parentTitle: '', // 家长身份标识
    parentTitleOptions: [],
    loading: false,
    focusNickname: false
  },

  onLoad() {
    this.setData({
      parentTitleOptions: util.getParentTitleOptions()
    })
  },

  onShow() {
    this.checkAlreadyRegistered()
  },

  // 检查是否已注册
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
      // 未注册或网络异常
    }
  },

  // 选择头像后，自动聚焦昵称输入框弹出微信昵称键盘
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({
      avatarUrl: avatarUrl || ''
    })
    // 选完头像后，延迟一下自动聚焦昵称输入框
    if (!this.data.nickName) {
      setTimeout(() => {
        this.setData({ focusNickname: true })
      }, 300)
    }
  },

  // 昵称输入
  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value })
  },

  // 昵称失焦（type=nickname 选择微信昵称后在 blur 拿到真实值）
  onNickNameBlur(e) {
    const val = (e.detail.value || '').trim()
    if (val) {
      this.setData({ nickName: val, focusNickname: false })
    }
  },

  // 选择角色
  onSelectRole(e) {
    const role = e.currentTarget.dataset.role
    this.setData({
      role,
      parentTitle: role === 'child' ? '' : this.data.parentTitle
    })
  },

  // 选择家长身份
  onSelectParentTitle(e) {
    this.setData({ parentTitle: e.currentTarget.dataset.title })
  },

  // 提交注册
  async onRegister() {
    const { nickName, role, parentTitle, avatarUrl } = this.data
    if (!avatarUrl) {
      return api.showToast('请点击头像设置微信头像')
    }
    if (!nickName || nickName.trim() === '') {
      return api.showToast('请设置昵称')
    }
    if (!role) {
      return api.showToast('请选择身份')
    }
    if (role === 'parent' && !parentTitle) {
      return api.showToast('请选择家长身份')
    }

    this.setData({ loading: true })
    api.showLoading('注册中...')

    try {
      const registerData = {
        nickName: nickName.trim(),
        role,
        avatarUrl
      }
      if (role === 'parent') {
        registerData.parentTitle = parentTitle
      }

      const res = await api.callCloud('register', registerData)
      api.hideLoading()
      api.showToast('注册成功')

      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      app.globalData.userInfo = userRes.data
      app.globalData.isLoggedIn = true

      setTimeout(() => {
        wx.redirectTo({ url: '/pages/family/index' })
      }, 800)
    } catch (err) {
      api.hideLoading()
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
