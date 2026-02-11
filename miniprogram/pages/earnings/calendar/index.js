// 收益日历页（参考微众银行）
const api = require('../../../utils/api')
const util = require('../../../utils/util')

Page({
  data: {
    isParent: false,
    currentYear: 0,
    currentMonth: 0,
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarWeeks: [],
    earningsMap: {},
    selectedDate: '',
    selectedDetail: null,
    monthTotal: '0.00',
    todayEarning: '0.00',
    loading: true,
    childOpenId: '',
    // 家长选择小孩
    children: [],
    selectedChildIndex: 0
  },

  onLoad(options) {
    const now = new Date()
    const app = getApp()
    const userInfo = app.globalData.userInfo
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      selectedDate: util.formatDate(now),
      isParent: userInfo && userInfo.role === 'parent',
      childOpenId: options.childOpenId || ''
    })
    this.initData()
  },

  async initData() {
    const { isParent, childOpenId } = this.data
    if (isParent && !childOpenId) {
      try {
        const membersRes = await api.callCloud('getFamilyMembers')
        const children = (membersRes.data || []).filter(m => m.role === 'child')
        if (children.length > 0) {
          this.setData({
            children,
            childOpenId: children[0]._openid,
            selectedChildIndex: 0
          })
        }
      } catch (e) {}
    }
    // 先触发收益计算
    await api.callCloud('calcAllEarnings', { childOpenId: this.data.childOpenId }).catch(() => {})
    await this.loadCalendar()
  },

  async loadCalendar() {
    const { currentYear, currentMonth, childOpenId } = this.data
    const calendarWeeks = util.generateCalendarData(currentYear, currentMonth)

    try {
      const res = await api.callCloud('getEarningsCalendar', {
        childOpenId,
        year: currentYear,
        month: currentMonth
      })

      if (res.code === 0 && res.data) {
        const earningsMap = {}
        res.data.calendar.forEach(d => {
          earningsMap[d.date] = d
        })

        // 为日历添加收益标记
        calendarWeeks.forEach(week => {
          week.forEach(day => {
            if (day.date && earningsMap[day.date]) {
              day.hasEarning = true
              day.earning = earningsMap[day.date].totalEarning
              day.earningStr = earningsMap[day.date].totalEarning >= 0
                ? '+' + earningsMap[day.date].totalEarning.toFixed(2)
                : earningsMap[day.date].totalEarning.toFixed(2)
            }
          })
        })

        const today = util.formatDate(new Date())
        const todayData = earningsMap[today]

        this.setData({
          calendarWeeks,
          earningsMap,
          monthTotal: util.formatMoney(res.data.monthTotal),
          todayEarning: todayData ? '+' + todayData.totalEarning.toFixed(2) : '+0.00',
          selectedDetail: earningsMap[this.data.selectedDate] || null
        })
      } else {
        this.setData({ calendarWeeks })
      }
    } catch (err) {
      this.setData({ calendarWeeks })
      console.error('加载日历失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  onPrevMonth() {
    let { currentYear, currentMonth } = this.data
    if (currentMonth === 1) { currentMonth = 12; currentYear-- }
    else currentMonth--
    this.setData({ currentYear, currentMonth, loading: true })
    this.loadCalendar()
  },

  onNextMonth() {
    let { currentYear, currentMonth } = this.data
    if (currentMonth === 12) { currentMonth = 1; currentYear++ }
    else currentMonth++
    this.setData({ currentYear, currentMonth, loading: true })
    this.loadCalendar()
  },

  onDateTap(e) {
    const date = e.currentTarget.dataset.date
    if (!date) return
    this.setData({
      selectedDate: date,
      selectedDetail: this.data.earningsMap[date] || null
    })
  },

  onChildChange(e) {
    const index = e.detail.value
    const child = this.data.children[index]
    if (child) {
      this.setData({
        selectedChildIndex: parseInt(index),
        childOpenId: child._openid,
        loading: true
      })
      this.loadCalendar()
    }
  }
})
