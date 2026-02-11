// 首页 - 存款概览
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    isParent: false,
    deposit: null,
    childDeposits: [],
    hasFamily: false,
    pendingCount: 0,
    loading: true,
    todayEarning: '0.00'
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

  // 检查登录状态
  checkLoginAndLoad() {
    const app = getApp()
    if (app.globalData.isLoggedIn) {
      this.setData({ userInfo: app.globalData.userInfo })
      this.loadData()
    } else {
      // 等待登录回调
      app.loginCallback = (userInfo) => {
        this.setData({ userInfo })
        this.loadData()
      }
      // 延迟检测，如果仍未登录则跳转
      setTimeout(() => {
        if (!app.globalData.isLoggedIn) {
          this.setData({ loading: false })
          wx.redirectTo({ url: '/pages/login/index' })
        }
      }, 3000)
    }
  },

  // 加载数据
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

  // 加载家长数据
  async loadParentData() {
    try {
      const [depositsRes, pendingRes] = await Promise.all([
        api.callCloud('getChildDeposits'),
        api.callCloud('getPendingCount')
      ])

      // 为每个小孩计算收益
      const childDeposits = depositsRes.data || []
      for (let d of childDeposits) {
        try {
          await api.callCloud('calcEarnings', { childOpenId: d.childOpenId })
        } catch (e) { /* 忽略 */ }
      }

      // 重新获取最新数据
      const updatedRes = await api.callCloud('getChildDeposits')

      this.setData({
        childDeposits: (updatedRes.data || []).map(d => ({
          ...d,
          principalStr: util.formatMoney(d.principal),
          balanceStr: util.formatMoney(d.balance),
          earningsStr: util.formatMoney(d.totalEarnings),
          rateStr: d.rate + '%'
        })),
        pendingCount: pendingRes.data ? pendingRes.data.count : 0
      })
    } catch (err) {
      console.error('加载家长数据失败:', err)
    }
  },

  // 加载小孩数据
  async loadChildData() {
    try {
      // 先触发收益计算
      await api.callCloud('calcEarnings', {}).catch(() => {})

      const depositRes = await api.callCloud('getDeposit', {})
      if (depositRes.code === 0 && depositRes.data) {
        const d = depositRes.data
        // 获取今日收益
        const today = util.formatDate(new Date())
        let todayEarning = '0.00'
        try {
          const calendarRes = await api.callCloud('getEarningsCalendar', {
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1
          })
          if (calendarRes.data) {
            const todayRecord = calendarRes.data.find(e => e.date === today)
            if (todayRecord) {
              todayEarning = util.formatMoney(todayRecord.dailyEarning)
            }
          }
        } catch (e) { /* 忽略 */ }

        this.setData({
          deposit: {
            ...d,
            principalStr: util.formatMoney(d.principal),
            balanceStr: util.formatMoney(d.balance),
            earningsStr: util.formatMoney(d.totalEarnings),
            totalStr: util.formatMoney(d.balance + d.totalEarnings),
            rateStr: d.rate + '%'
          },
          todayEarning
        })
      }
    } catch (err) {
      console.error('加载小孩数据失败:', err)
    }
  },

  // 跳转家庭管理
  goFamily() {
    wx.navigateTo({ url: '/pages/family/index' })
  },

  // 跳转存款设置
  goDeposit(e) {
    const childOpenId = e.currentTarget.dataset.childid || ''
    wx.navigateTo({ url: `/pages/deposit/index?childOpenId=${childOpenId}` })
  },

  // 跳转取现审批
  goReview() {
    wx.navigateTo({ url: '/pages/withdraw/review/index' })
  },

  // 跳转取现申请
  goWithdraw() {
    wx.navigateTo({ url: '/pages/withdraw/apply/index' })
  },

  // 跳转收益
  goEarnings() {
    wx.switchTab({ url: '/pages/earnings/index' })
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  }
})
