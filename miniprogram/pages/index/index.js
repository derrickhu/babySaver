// 首页 - 资产总览（参考微众银行）
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    isParent: false,
    hasFamily: false,
    loading: true,
    // 资产数据
    totalAssets: '0.00',
    totalEarnings: '0.00',
    yesterdayEarnings: '0.00',
    account: null,
    investments: [],
    pendingCount: 0,
    // 家长：小孩列表和当前选中
    children: [],
    selectedChildIndex: 0,
    selectedChildId: ''
  },

  onLoad() {
    this.checkLoginAndLoad()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    const app = getApp()
    if (app.globalData.isLoggedIn) {
      this.loadData()
    }
  },

  checkLoginAndLoad() {
    const app = getApp()
    if (app.globalData.isLoggedIn) {
      this.setData({ userInfo: app.globalData.userInfo })
      this.loadData()
    } else {
      app.loginCallback = (userInfo) => {
        this.setData({ userInfo })
        this.loadData()
      }
      setTimeout(() => {
        if (!app.globalData.isLoggedIn) {
          this.setData({ loading: false })
          wx.redirectTo({ url: '/pages/login/index' })
        }
      }, 3000)
    }
  },

  async loadData() {
    const app = getApp()
    const userInfo = app.globalData.userInfo
    if (!userInfo) return

    this.setData({
      userInfo,
      isParent: userInfo.role === 'parent',
      hasFamily: !!userInfo.familyId
    })

    if (!userInfo.familyId) {
      this.setData({ loading: false })
      return
    }

    try {
      if (userInfo.role === 'parent') {
        await this.loadParentData()
      } else {
        await this.loadChildData()
      }
    } catch (err) {
      console.error('加载数据失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 家长：加载小孩列表，默认展示第一个小孩
  async loadParentData() {
    const [membersRes, pendingRes] = await Promise.all([
      api.callCloud('getFamilyMembers'),
      api.callCloud('getPendingCount')
    ])

    const children = (membersRes.data || []).filter(m => m.role === 'child')
    this.setData({
      children,
      pendingCount: pendingRes.data ? pendingRes.data.count : 0
    })

    if (children.length > 0) {
      const childId = children[this.data.selectedChildIndex]?._openid || children[0]._openid
      this.setData({ selectedChildId: childId })
      await this.loadAssetSummary(childId)
    }
  },

  // 小孩：加载自己的数据
  async loadChildData() {
    await this.loadAssetSummary()
  },

  // 加载资产总览
  async loadAssetSummary(childOpenId) {
    try {
      const params = childOpenId ? { childOpenId } : {}
      const res = await api.callCloud('getAssetSummary', params)
      if (res.code === 0 && res.data) {
        const d = res.data
        this.setData({
          totalAssets: util.formatMoney(d.totalAssets),
          totalEarnings: util.formatMoney(d.totalEarnings),
          yesterdayEarnings: util.formatMoney(d.yesterdayEarnings),
          account: d.account ? {
            ...d.account,
            balanceStr: util.formatMoney(d.account.balance),
            earningsStr: util.formatMoney(d.account.totalEarnings),
            totalValueStr: util.formatMoney(d.account.totalValue),
            dailyEarningStr: (d.account.balance * d.account.baseRate / 100 / 365).toFixed(4)
          } : null,
          investments: (d.investments || []).map(inv => ({
            ...inv,
            amountStr: util.formatMoney(inv.amount),
            earningsStr: util.formatMoney(inv.earnings),
            totalValueStr: util.formatMoney(inv.totalValue),
            rateStr: inv.rate + '%',
            dailyEarningStr: (inv.amount * inv.rate / 100 / 365).toFixed(4)
          }))
        })
      }
    } catch (err) {
      console.error('加载资产失败:', err)
    }
  },

  // 家长切换小孩
  onChildChange(e) {
    const index = e.detail.value
    const child = this.data.children[index]
    if (child) {
      this.setData({
        selectedChildIndex: parseInt(index),
        selectedChildId: child._openid,
        loading: true
      })
      this.loadAssetSummary(child._openid).then(() => {
        this.setData({ loading: false })
      })
    }
  },

  // 导航
  goEarningsCalendar() {
    const childId = this.data.isParent ? this.data.selectedChildId : ''
    wx.navigateTo({ url: `/pages/earnings/calendar/index?childOpenId=${childId}` })
  },

  goBills() {
    wx.switchTab({ url: '/pages/earnings/index' })
  },

  goDeposit() {
    const childId = this.data.selectedChildId
    wx.navigateTo({ url: `/pages/deposit/index?childOpenId=${childId}` })
  },

  goWithdraw() {
    wx.navigateTo({ url: '/pages/withdraw/apply/index' })
  },

  goProductManage() {
    wx.navigateTo({ url: '/pages/product/manage/index' })
  },

  goProductDetail(e) {
    const productId = e.currentTarget.dataset.productid
    const investmentId = e.currentTarget.dataset.investmentid || ''
    wx.navigateTo({ url: `/pages/product/detail/index?productId=${productId}&investmentId=${investmentId}` })
  },

  goReview() {
    wx.navigateTo({ url: '/pages/withdraw/review/index' })
  },

  goFamily() {
    wx.navigateTo({ url: '/pages/family/index' })
  },

  goProducts() {
    wx.navigateTo({ url: '/pages/product/manage/index' })
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh())
  }
})
