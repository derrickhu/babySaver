// 注册页面 - 分步注册（Step1 选身份 → Step2 填资料）
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    step: 1,           // 当前步骤：1=选身份，2=填资料
    agreed: false,
    avatarUrl: '',
    defaultEmoji: '👤',
    useDefaultAvatar: true,
    nickName: '',
    role: '',
    parentTitle: '',
    parentTitleOptions: [],
    loading: false,
    focusNickname: false
  },

  onLoad(options) {
    this.pendingInviteCode = options.inviteCode || ''
    this.setData({
      parentTitleOptions: util.getParentTitleOptions()
    })

    // 从首页带 role 参数进入时，直接跳到 Step 2
    if (options.role === 'parent' || options.role === 'child') {
      const role = options.role
      const emoji = util.getDefaultAvatarEmoji(role, '')
      const defaultNick = util.getDefaultNickName(role, '')
      this.setData({
        step: 2,
        role,
        defaultEmoji: emoji,
        nickName: defaultNick,
        useDefaultAvatar: true,
        avatarUrl: ''
      })
    }
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
        if (this.pendingInviteCode) {
          wx.redirectTo({ url: `/pages/family/index?inviteCode=${this.pendingInviteCode}` })
        } else {
          wx.switchTab({ url: '/pages/index/index' })
        }
      }
    } catch (e) {
      // 未注册，停留在注册页
    }
  },

  // 勾选/取消协议
  onToggleAgreement() {
    this.setData({ agreed: !this.data.agreed })
  },

  onViewAgreement() {
    wx.navigateTo({ url: '/pages/agreement/index' })
  },

  onViewPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/index' })
  },

  // Step 1: 选择角色 → 自动进入 Step 2
  onSelectRole(e) {
    const role = e.currentTarget.dataset.role
    const parentTitle = role === 'child' ? '' : this.data.parentTitle
    const emoji = util.getDefaultAvatarEmoji(role, parentTitle)
    const defaultNick = util.getDefaultNickName(role, parentTitle)

    this.setData({
      role,
      parentTitle,
      defaultEmoji: emoji,
      nickName: defaultNick,
      useDefaultAvatar: true,
      avatarUrl: ''
    })

    // 延迟切换到 Step 2，让用户看到选中效果
    setTimeout(() => {
      this.setData({ step: 2 })
    }, 200)
  },

  // Step 2: 返回 Step 1
  onBackToStep1() {
    this.setData({ step: 1, role: '' })
  },

  // 选择家长身份 — 更新默认头像和昵称
  onSelectParentTitle(e) {
    const parentTitle = e.currentTarget.dataset.title
    const emoji = util.getDefaultAvatarEmoji('parent', parentTitle)
    const defaultNick = util.getDefaultNickName('parent', parentTitle)

    const updates = { parentTitle, defaultEmoji: emoji }
    if (this.data.useDefaultAvatar) {
      updates.nickName = defaultNick
    }
    this.setData(updates)
  },

  // 微信授权获取头像
  async onChooseAvatar(e) {
    const { avatarUrl: tempPath } = e.detail
    if (!tempPath) return

    this.setData({ avatarUrl: tempPath, useDefaultAvatar: false })

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
      this.setData({ avatarUrl: '', useDefaultAvatar: true })
      api.hideLoading()
      return
    }
    api.hideLoading()
  },

  // 恢复使用默认头像
  onUseDefaultAvatar() {
    this.setData({ avatarUrl: '', useDefaultAvatar: true })
  },

  // 昵称输入
  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value })
  },

  onNickNameBlur(e) {
    const val = (e.detail.value || '').trim()
    if (val) {
      this.setData({ nickName: val, focusNickname: false })
    }
  },

  // 提交注册
  async onRegister() {
    const { nickName, role, parentTitle, avatarUrl, useDefaultAvatar, defaultEmoji, agreed } = this.data

    if (!agreed) {
      return api.showToast('请先阅读并同意协议')
    }
    if (!role) {
      return api.showToast('请选择身份')
    }
    if (role === 'parent' && !parentTitle) {
      return api.showToast('请选择家长身份')
    }
    if (!nickName || nickName.trim() === '') {
      return api.showToast('请设置昵称')
    }

    this.setData({ loading: true })
    api.showLoading('注册中...')

    try {
      const finalAvatar = useDefaultAvatar ? `emoji:${defaultEmoji}` : avatarUrl

      const registerData = {
        nickName: nickName.trim(),
        role,
        avatarUrl: finalAvatar
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
        if (this.pendingInviteCode) {
          wx.redirectTo({ url: `/pages/family/index?inviteCode=${this.pendingInviteCode}` })
        } else {
          wx.switchTab({ url: '/pages/index/index' })
        }
      }, 800)
    } catch (err) {
      api.hideLoading()
      if (err.msg === '用户已注册') {
        const app = getApp()
        api.callCloud('getUserInfo').then(userRes => {
          if (userRes.data) {
            app.globalData.userInfo = userRes.data
            app.globalData.isLoggedIn = true
            if (this.pendingInviteCode) {
              wx.redirectTo({ url: `/pages/family/index?inviteCode=${this.pendingInviteCode}` })
            } else {
              wx.switchTab({ url: '/pages/index/index' })
            }
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
