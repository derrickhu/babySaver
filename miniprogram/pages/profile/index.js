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
    loading: true
  },

  onLoad() {
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

  // 关于
  onAbout() {
    wx.showModal({
      title: '关于小孩存钱宝',
      content: '小孩存钱宝是一款帮助家长培养孩子理财意识的小程序。\n\n家长可以为小孩设置虚拟存款和利率，让孩子直观感受存钱的收益。\n\n版本 1.0.0',
      showCancel: false,
      confirmText: '知道了'
    })
  }
})
