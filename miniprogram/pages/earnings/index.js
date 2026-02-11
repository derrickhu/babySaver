// 收益页 - 日历 + 趋势
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    isParent: false,
    deposit: null,
    // 日历相关
    currentYear: 0,
    currentMonth: 0,
    calendarWeeks: [],
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    earningsMap: {},
    selectedDate: '',
    selectedEarning: null,
    monthTotal: '0.00',
    // 趋势相关
    trendData: [],
    maxEarning: 0,
    trendDays: 30,
    // Tab
    activeTab: 'calendar',
    loading: true,
    // 家长视图
    children: [],
    selectedChildId: '',
    selectedChildIndex: 0
  },

  onLoad() {
    const now = new Date()
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      selectedDate: util.formatDate(now)
    })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.initData()
  },

  // 初始化数据
  async initData() {
    const app = getApp()
    const userInfo = app.globalData.userInfo
    if (!userInfo || !userInfo.familyId) {
      this.setData({ loading: false })
      return
    }

    const isParent = userInfo.role === 'parent'
    this.setData({ userInfo, isParent })

    if (isParent) {
      // 家长: 获取家庭中的小孩列表
      try {
        const membersRes = await api.callCloud('getFamilyMembers')
        const children = (membersRes.data || []).filter(m => m.role === 'child')
        if (children.length > 0) {
          this.setData({
            children,
            selectedChildId: children[0]._openid,
            selectedChildIndex: 0
          })
          await this.loadAllData(children[0]._openid)
        }
      } catch (err) {
        console.error('加载失败:', err)
      }
    } else {
      // 小孩: 直接加载自己的数据
      await this.loadAllData('')
    }

    this.setData({ loading: false })
  },

  // 加载全部数据
  async loadAllData(childOpenId) {
    await Promise.all([
      this.loadCalendarData(childOpenId),
      this.loadTrendData(childOpenId),
      this.loadDeposit(childOpenId)
    ])
  },

  // 加载存款信息
  async loadDeposit(childOpenId) {
    try {
      const res = await api.callCloud('getDeposit', { childOpenId })
      if (res.code === 0 && res.data) {
        this.setData({
          deposit: {
            ...res.data,
            principalStr: util.formatMoney(res.data.principal),
            balanceStr: util.formatMoney(res.data.balance),
            earningsStr: util.formatMoney(res.data.totalEarnings),
            rateStr: res.data.rate + '%'
          }
        })
      }
    } catch (err) { /* 忽略 */ }
  },

  // 加载日历数据
  async loadCalendarData(childOpenId) {
    const { currentYear, currentMonth } = this.data

    // 生成日历网格
    const calendarWeeks = util.generateCalendarData(currentYear, currentMonth)

    try {
      // 先触发收益计算
      await api.callCloud('calcEarnings', { childOpenId }).catch(() => {})

      const res = await api.callCloud('getEarningsCalendar', {
        childOpenId,
        year: currentYear,
        month: currentMonth
      })

      const earningsMap = {}
      let monthTotal = 0
      if (res.data) {
        res.data.forEach(e => {
          earningsMap[e.date] = e
          monthTotal += e.dailyEarning
        })
      }

      // 为日历添加收益标记
      calendarWeeks.forEach(week => {
        week.forEach(day => {
          if (day.date && earningsMap[day.date]) {
            day.hasEarning = true
            day.earning = earningsMap[day.date].dailyEarning
          }
        })
      })

      // 检查选中日期的收益
      const selectedEarning = earningsMap[this.data.selectedDate] || null

      this.setData({
        calendarWeeks,
        earningsMap,
        monthTotal: util.formatMoney(monthTotal),
        selectedEarning
      })
    } catch (err) {
      this.setData({ calendarWeeks })
      console.error('加载日历数据失败:', err)
    }
  },

  // 加载趋势数据
  async loadTrendData(childOpenId) {
    try {
      const res = await api.callCloud('getEarningsTrend', {
        childOpenId,
        days: this.data.trendDays
      })
      if (res.data && res.data.length > 0) {
        const maxEarning = Math.max(...res.data.map(e => e.dailyEarning))
        this.setData({
          trendData: res.data.map(e => ({
            ...e,
            dateShort: e.date.substring(5),
            earningStr: util.formatMoney(e.dailyEarning),
            barHeight: maxEarning > 0 ? Math.max((e.dailyEarning / maxEarning) * 100, 5) : 5
          })),
          maxEarning
        })
      } else {
        this.setData({ trendData: [], maxEarning: 0 })
      }
    } catch (err) {
      console.error('加载趋势数据失败:', err)
    }
  },

  // 切换Tab
  onTabChange(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  // 上一月
  onPrevMonth() {
    let { currentYear, currentMonth } = this.data
    if (currentMonth === 1) {
      currentMonth = 12
      currentYear--
    } else {
      currentMonth--
    }
    this.setData({ currentYear, currentMonth })
    this.loadCalendarData(this.data.selectedChildId)
  },

  // 下一月
  onNextMonth() {
    let { currentYear, currentMonth } = this.data
    if (currentMonth === 12) {
      currentMonth = 1
      currentYear++
    } else {
      currentMonth++
    }
    this.setData({ currentYear, currentMonth })
    this.loadCalendarData(this.data.selectedChildId)
  },

  // 选择日期
  onDateTap(e) {
    const { date } = e.currentTarget.dataset
    if (!date) return
    const selectedEarning = this.data.earningsMap[date] || null
    this.setData({ selectedDate: date, selectedEarning })
  },

  // 切换趋势天数
  onTrendDaysChange(e) {
    const days = parseInt(e.currentTarget.dataset.days)
    this.setData({ trendDays: days })
    this.loadTrendData(this.data.selectedChildId)
  },

  // 切换小孩（家长视图）
  onChildChange(e) {
    const index = e.detail.value
    const child = this.data.children[index]
    this.setData({
      selectedChildIndex: index,
      selectedChildId: child._openid
    })
    this.loadAllData(child._openid)
  }
})
