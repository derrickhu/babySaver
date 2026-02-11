// 家庭管理页
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    isParent: false,
    hasFamily: false,
    isCreator: false,
    family: null,
    members: [],
    inviteCode: '',
    inputCode: '',
    loading: true
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    if (!this.data.loading) {
      this.loadData()
    }
  },

  // 加载数据
  async loadData() {
    const app = getApp()
    const userInfo = app.globalData.userInfo
    if (!userInfo) {
      wx.redirectTo({ url: '/pages/login/index' })
      return
    }

    this.setData({
      userInfo,
      isParent: userInfo.role === 'parent',
      hasFamily: !!userInfo.familyId
    })

    if (userInfo.familyId) {
      try {
        const [familyRes, membersRes] = await Promise.all([
          api.callCloud('getFamily'),
          api.callCloud('getFamilyMembers')
        ])

        if (familyRes.code === 0) {
          this.setData({
            family: familyRes.data,
            inviteCode: familyRes.data.inviteCode,
            isCreator: !!familyRes.data.isCreator
          })
        }
        if (membersRes.code === 0) {
          this.setData({
            members: membersRes.data.map(m => ({
              ...m,
              roleText: util.getMemberRoleText(m),
              emoji: util.getMemberEmoji(m)
            }))
          })
        }
      } catch (err) {
        console.error('加载家庭信息失败:', err)
      }
    }

    this.setData({ loading: false })
  },

  // 创建家庭（家长）
  async onCreateFamily() {
    api.showLoading('创建中...')
    try {
      const res = await api.callCloud('createFamily', {})
      api.hideLoading()
      api.showToast('家庭创建成功')

      // 刷新用户信息
      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      app.globalData.userInfo = userRes.data

      this.loadData()
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg)
    }
  },

  // 输入邀请码
  onCodeInput(e) {
    this.setData({ inputCode: e.detail.value.toUpperCase() })
  },

  // 加入家庭（小孩或家长均可）
  async onJoinFamily() {
    const { inputCode } = this.data
    if (!inputCode || inputCode.length < 6) {
      return api.showToast('请输入完整的邀请码')
    }

    api.showLoading('加入中...')
    try {
      const res = await api.callCloud('joinFamily', { inviteCode: inputCode })
      api.hideLoading()
      api.showToast('加入家庭成功')

      // 刷新用户信息
      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      app.globalData.userInfo = userRes.data

      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' })
      }, 800)
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg)
    }
  },

  // 复制邀请码（仅创建者可用）
  onCopyCode() {
    if (!this.data.isCreator) {
      return api.showToast('仅家庭创建者可分享邀请码')
    }
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        api.showToast('邀请码已复制')
      }
    })
  },

  // 返回首页
  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
