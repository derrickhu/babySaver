// 个人中心页
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    isParent: false,
    hasFamily: false,
    isCreator: false,
    family: null,
    account: null,
    pendingCount: 0,
    loading: true,
    parentTitleOptions: [],
    showTitlePicker: false,
    showRateModal: false,
    baseRate: '',
    canDeposit: false,
    canReview: false,
    canProductManage: false
  },

  onLoad() {
    this.setData({ parentTitleOptions: util.getParentTitleOptions() })
    this.loadData()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    const app = getApp()
    if (app.globalData.isLoggedIn) {
      this.loadData()
    }
  },

  async loadData() {
    const app = getApp()

    try {
      const userRes = await api.callCloud('getUserInfo')
      if (userRes.code === 0 && userRes.data) {
        app.globalData.userInfo = userRes.data
      }
    } catch (e) {}

    const userInfo = app.globalData.userInfo
    if (!userInfo) {
      this.setData({ loading: false })
      return
    }

    this.setData({
      userInfo,
      isParent: userInfo.role === 'parent',
      hasFamily: !!userInfo.familyId
    })

    if (userInfo.familyId) {
      try {
        const promises = [api.callCloud('getFamily')]

        if (userInfo.role === 'parent') {
          promises.push(api.callCloud('getPendingCount'))
        } else {
          promises.push(api.callCloud('getAccount', {}))
        }

        const results = await Promise.all(promises)

        if (results[0].code === 0) {
          const family = results[0].data
          const myPerms = family.myPermissions || {}
          this.setData({
            family,
            isCreator: family.isCreator,
            baseRate: String(family.baseRate || 2.0),
            canDeposit: myPerms.deposit || family.isCreator,
            canReview: myPerms.withdrawReview || family.isCreator,
            canProductManage: myPerms.productManage || family.isCreator
          })
        }

        if (userInfo.role === 'parent' && results[1].code === 0) {
          this.setData({ pendingCount: results[1].data.count })
        } else if (userInfo.role === 'child' && results[1].code === 0 && results[1].data) {
          const a = results[1].data
          this.setData({
            account: {
              ...a,
              totalStr: util.formatMoney(a.balance + a.totalEarnings)
            }
          })
        }
      } catch (err) {
        console.error('加载失败:', err)
      }
    }

    this.setData({ loading: false })
  },

  // 更换头像（上传云存储后更新）
  async onChooseAvatar(e) {
    const { avatarUrl: tempPath } = e.detail
    if (!tempPath) return

    api.showLoading('上传头像...')
    try {
      const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempPath
      })
      await api.callCloud('updateAvatar', { avatarUrl: uploadRes.fileID })
      api.hideLoading()
      api.showToast('头像已更新')

      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      if (userRes.code === 0 && userRes.data) {
        app.globalData.userInfo = userRes.data
        this.setData({ userInfo: userRes.data })
      }
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg || '头像更新失败')
    }
  },

  goFamily() {
    wx.navigateTo({ url: '/pages/family/index' })
  },

  goDeposit() {
    wx.navigateTo({ url: '/pages/deposit/index' })
  },

  goReview() {
    wx.navigateTo({ url: '/pages/withdraw/review/index' })
  },

  goWithdraw() {
    wx.navigateTo({ url: '/pages/withdraw/apply/index' })
  },

  goProducts() {
    wx.navigateTo({ url: '/pages/product/manage/index' })
  },

  goPermissions() {
    wx.navigateTo({ url: '/pages/family/permissions/index' })
  },

  // 家长身份修改
  onShowTitlePicker() {
    this.setData({ showTitlePicker: true })
  },

  onHideTitlePicker() {
    this.setData({ showTitlePicker: false })
  },

  async onChangeParentTitle(e) {
    const newTitle = e.currentTarget.dataset.title
    if (!newTitle) return

    api.showLoading('修改中...')
    try {
      await api.callCloud('updateParentTitle', { parentTitle: newTitle })
      api.hideLoading()
      api.showToast('身份修改成功')

      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      if (userRes.code === 0 && userRes.data) {
        app.globalData.userInfo = userRes.data
        this.setData({ userInfo: userRes.data, showTitlePicker: false })
      }
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg || '修改失败')
    }
  },

  // 基础利率设置
  onShowRateModal() {
    this.setData({ showRateModal: true })
  },

  onHideRateModal() {
    this.setData({ showRateModal: false })
  },

  onBaseRateInput(e) {
    this.setData({ baseRate: e.detail.value })
  },

  async onSaveBaseRate() {
    const rate = parseFloat(this.data.baseRate)
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return api.showError('请输入0-100的利率')
    }

    api.showLoading('保存中...')
    try {
      await api.callCloud('setBaseRate', { baseRate: rate })
      api.hideLoading()
      api.showToast('利率设置成功')
      this.setData({ showRateModal: false })
      this.loadData()
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg || '设置失败')
    }
  },

  onAbout() {
    wx.showModal({
      title: '关于小孩存钱宝',
      content: '小孩存钱宝是一款帮助家长培养孩子理财意识的小程序。\n\n家长可以为小孩设置虚拟存款，并通过理财产品培养孩子的理财观念。\n\n版本 2.0.0',
      showCancel: false,
      confirmText: '知道了'
    })
  }
})
