// 登录注册页（微信一键登录 + 资料完善两步流程）
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    step: 1,           // 1=欢迎屏  2=资料填写
    agreed: true,      // 默认勾选协议
    avatarUrl: '',
    nickName: '',
    role: '',          // 'parent' 或 'child'
    parentTitle: '',
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
    // 已注册用户直接跳转首页
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
      // 未注册或网络异常，停留在登录页
    }
  },

  // ========== Step 1 ==========

  // 勾选/取消协议
  onToggleAgreement() {
    this.setData({ agreed: !this.data.agreed })
  },

  // 查看用户协议（占位）
  onViewAgreement() {
    wx.showModal({ title: '用户协议', content: '暂无内容', showCancel: false })
  },

  // 查看隐私政策（占位）
  onViewPrivacy() {
    wx.showModal({ title: '隐私政策', content: '暂无内容', showCancel: false })
  },

  // 选择头像（Step 1 一键登录触发 / Step 2 更换头像触发）
  // 临时头像需上传云存储得到永久 fileID，否则会过期导致无法显示
  async onChooseAvatar(e) {
    if (!this.data.agreed) {
      return api.showToast('请先阅读并同意协议')
    }

    const { avatarUrl: tempPath } = e.detail
    if (!tempPath) return

    // 先展示选中的头像（本地临时）
    this.setData({ avatarUrl: tempPath })

    // 上传到云存储，获取永久 fileID
    api.showLoading('上传头像...')
    try {
      const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempPath
      })
      this.setData({ avatarUrl: uploadRes.fileID })
    } catch (err) {
      console.error('头像上传失败:', err)
      api.showToast('头像上传失败，请重试')
      this.setData({ avatarUrl: tempPath }) // 仍保留临时路径，注册时可能还在有效期内
    }
    api.hideLoading()

    // 如果在 Step 1，选完头像自动进入 Step 2
    if (this.data.step === 1) {
      this.setData({ step: 2 })
      setTimeout(() => {
        this.setData({ focusNickname: true })
      }, 400)
    }
  },

  // 返回欢迎屏
  onBackToWelcome() {
    this.setData({ step: 1 })
  },

  // ========== Step 2 ==========

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
      return api.showToast('请设置头像')
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

      await api.callCloud('register', registerData)
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
        // 已注册用户直接跳转
        const app = getApp()
        api.callCloud('getUserInfo').then(userRes => {
          if (userRes.data) {
            app.globalData.userInfo = userRes.data
            app.globalData.isLoggedIn = true
            wx.switchTab({ url: '/pages/index/index' })
          }
        }).catch(() => api.showError('登录失败'))
      } else {
        api.showError(err.msg || '注册失败')
      }
    } finally {
      this.setData({ loading: false })
    }
  }
})
