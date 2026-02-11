// 个人中心页
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    isParent: false,
    hasFamily: false,
    family: null,
    deposit: null,
    pendingCount: 0,
    loading: true,
    parentTitleOptions: [],
    showTitlePicker: false
  },

  onLoad() {
    this.setData({
      parentTitleOptions: util.getParentTitleOptions()
    })
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

  // 加载数据
  async loadData() {
    const app = getApp()

    // 先刷新用户信息
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
          promises.push(api.callCloud('getDeposit', {}))
        }

        const results = await Promise.all(promises)

        if (results[0].code === 0) {
          this.setData({ family: results[0].data })
        }

        if (userInfo.role === 'parent' && results[1].code === 0) {
          this.setData({ pendingCount: results[1].data.count })
        } else if (userInfo.role === 'child' && results[1].code === 0 && results[1].data) {
          const d = results[1].data
          this.setData({
            deposit: {
              ...d,
              totalStr: util.formatMoney(d.balance + d.totalEarnings)
            }
          })
        }
      } catch (err) {
        console.error('加载失败:', err)
      }
    }

    this.setData({ loading: false })
  },

  // 跳转家庭管理
  goFamily() {
    wx.navigateTo({ url: '/pages/family/index' })
  },

  // 跳转存款设置
  goDeposit() {
    wx.navigateTo({ url: '/pages/deposit/index' })
  },

  // 跳转取现审批
  goReview() {
    wx.navigateTo({ url: '/pages/withdraw/review/index' })
  },

  // 跳转取现申请
  goWithdraw() {
    wx.navigateTo({ url: '/pages/withdraw/apply/index' })
  },

  // 显示修改家长身份弹窗
  onShowTitlePicker() {
    this.setData({ showTitlePicker: true })
  },

  // 隐藏修改家长身份弹窗
  onHideTitlePicker() {
    this.setData({ showTitlePicker: false })
  },

  // 选择新的家长身份
  async onChangeParentTitle(e) {
    const newTitle = e.currentTarget.dataset.title
    if (!newTitle) return

    api.showLoading('修改中...')
    try {
      await api.callCloud('updateParentTitle', { parentTitle: newTitle })
      api.hideLoading()
      api.showToast('身份修改成功')

      // 刷新用户信息
      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      if (userRes.code === 0 && userRes.data) {
        app.globalData.userInfo = userRes.data
        this.setData({
          userInfo: userRes.data,
          showTitlePicker: false
        })
      }
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg || '修改失败')
    }
  },

  // 关于
  onAbout() {
    wx.showModal({
      title: '关于小孩存钱宝',
      content: '小孩存钱宝是一款帮助家长培养孩子理财意识的小程序。\n\n家长可以为小孩设置虚拟存款和利率，让孩子直观感受存钱的收益。\n\n版本 1.1.0',
      showCancel: false,
      confirmText: '知道了'
    })
  }
})
