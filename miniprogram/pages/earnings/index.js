// 账单明细页（全员可见）
const api = require('../../utils/api')
const util = require('../../utils/util')

// 快捷时间选项
const TIME_SHORTCUTS = [
  { key: 'all', label: '全部' },
  { key: 'week', label: '近7天' },
  { key: 'month', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'custom', label: '自定义' }
]

// 存入来源标签
const DEPOSIT_TAGS = [
  { key: 'pocket_money', label: '零花钱' },
  { key: 'new_year', label: '压岁钱' },
  { key: 'birthday', label: '生日红包' },
  { key: 'reward', label: '奖励' },
  { key: 'study', label: '学习奖金' },
  { key: 'chores', label: '家务劳动' },
  { key: 'gift', label: '礼物红包' },
  { key: 'savings', label: '主动存入' },
  { key: 'other', label: '其他' }
]

// 取现用途标签
const WITHDRAW_TAGS = [
  { key: 'snack', label: '零食' },
  { key: 'toy', label: '玩具' },
  { key: 'book', label: '书籍' },
  { key: 'stationery', label: '文具' },
  { key: 'clothing', label: '衣服' },
  { key: 'travel', label: '游玩' },
  { key: 'movie', label: '电影' },
  { key: 'sports', label: '运动' },
  { key: 'gift_buy', label: '买礼物' },
  { key: 'other', label: '其他' }
]

Page({
  data: {
    userInfo: null,
    isParent: false,
    transactions: [],
    loading: true,
    hasMore: true,
    page: 1,
    pageSize: 20,
    // 类型过滤
    activeFilter: 'all',
    filters: [
      { key: 'all', label: '全部' },
      { key: 'deposit', label: '收入' },
      { key: 'withdraw', label: '支出' },
      { key: 'buy', label: '买入' },
      { key: 'redeem', label: '赎回' }
    ],
    // 时间筛选
    timeShortcuts: TIME_SHORTCUTS,
    activeTime: 'all',
    startDate: '',
    endDate: '',
    showCustomTime: false,
    todayStr: '',
    // 标签筛选（收/支独立）
    activeTag: '',
    depositTags: DEPOSIT_TAGS,
    withdrawTags: WITHDRAW_TAGS,
    // 汇总
    summary: null,
    // 家长选择小孩
    children: [],
    selectedChildIndex: -1,
    selectedChildId: '',
    selectedChildName: ''
  },

  onLoad() {},

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.initData()
  },

  async initData() {
    const app = getApp()
    const userInfo = app.globalData.userInfo
    if (!userInfo || !userInfo.familyId) {
      this.setData({ loading: false })
      return
    }

    const isParent = userInfo.role === 'parent'
    const todayStr = util.formatDate(new Date())
    this.setData({ userInfo, isParent, todayStr })

    if (isParent) {
      try {
        const membersRes = await api.callCloud('getFamilyMembers')
        const children = (membersRes.data || []).filter(m => m.role === 'child')
        this.setData({ children })
      } catch (err) {
        console.error('获取成员失败:', err)
      }
    }

    this.setData({ page: 1, transactions: [], hasMore: true })
    await this.loadTransactions()
  },

  async loadTransactions() {
    const { page, pageSize, activeFilter, activeTag, startDate, endDate, selectedChildId, isParent } = this.data

    try {
      const params = { page, pageSize }
      if (activeFilter !== 'all') params.type = activeFilter
      if (activeTag) params.tag = activeTag
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      if (selectedChildId) params.childOpenId = selectedChildId

      const res = await api.callCloud('getTransactions', params)
      if (res.code === 0) {
        const newData = (res.data || []).map(t => ({
          ...t,
          amountStr: util.formatMoney(t.amount),
          typeText: util.getTransactionTypeText(t.type),
          typeIcon: t.tag ? util.getTagIcon(t.type, t.tag) || util.getTransactionTypeIcon(t.type) : util.getTransactionTypeIcon(t.type),
          statusText: util.getStatusText(t.status),
          timeStr: util.formatDateTime(t.createdAt),
          isIncome: ['deposit', 'redeem'].includes(t.type),
          showChildName: isParent && t.childName,
          tagLabel: t.tag ? util.getTagLabel(t.type, t.tag) : ''
        }))

        const merged = page === 1 ? newData : [...this.data.transactions, ...newData]
        const updateData = {
          transactions: merged,
          hasMore: newData.length >= pageSize
        }

        // 第一页时更新汇总数据
        if (page === 1 && res.summary) {
          updateData.summary = {
            totalIncome: util.formatMoney(res.summary.totalIncome),
            totalExpense: util.formatMoney(res.summary.totalExpense),
            net: util.formatMoney(res.summary.totalIncome - res.summary.totalExpense),
            txCount: res.summary.txCount
          }
        } else if (page === 1) {
          updateData.summary = null
        }

        this.setData(updateData)
      }
    } catch (err) {
      console.error('加载账单失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // ========== 类型筛选 ==========
  onFilterChange(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      activeFilter: key,
      activeTag: '',  // 切换类型时重置标签
      page: 1,
      transactions: [],
      hasMore: true,
      loading: true
    })
    this.loadTransactions()
  },

  // ========== 时间筛选 ==========
  onTimeShortcut(e) {
    const key = e.currentTarget.dataset.key
    const now = new Date()

    if (key === 'custom') {
      this.setData({ activeTime: 'custom', showCustomTime: true })
      return
    }

    let startDate = ''
    let endDate = ''

    if (key === 'week') {
      const d = new Date(now)
      d.setDate(d.getDate() - 6)
      startDate = util.formatDate(d)
      endDate = util.formatDate(now)
    } else if (key === 'month') {
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      startDate = `${y}-${m}-01`
      endDate = util.formatDate(now)
    } else if (key === 'lastMonth') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const dEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      startDate = util.formatDate(d)
      endDate = util.formatDate(dEnd)
    }

    this.setData({
      activeTime: key,
      startDate,
      endDate,
      showCustomTime: false,
      page: 1,
      transactions: [],
      hasMore: true,
      loading: true
    })
    this.loadTransactions()
  },

  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value })
    this._applyCustomTime()
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value })
    this._applyCustomTime()
  },

  _applyCustomTime() {
    const { startDate, endDate } = this.data
    if (startDate && endDate) {
      this.setData({
        page: 1,
        transactions: [],
        hasMore: true,
        loading: true
      })
      this.loadTransactions()
    }
  },

  // ========== 标签筛选 ==========
  onTagFilter(e) {
    const key = e.currentTarget.dataset.key
    // 再次点击同一标签则取消
    const newTag = this.data.activeTag === key ? '' : key
    this.setData({
      activeTag: newTag,
      page: 1,
      transactions: [],
      hasMore: true,
      loading: true
    })
    this.loadTransactions()
  },

  // ========== 家长切换小孩 ==========
  showChildPicker() {
    const names = ['全部小孩', ...this.data.children.map(c => c.nickName)]
    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        const tapIndex = res.tapIndex
        if (tapIndex === 0) {
          this.setData({ selectedChildId: '', selectedChildName: '' })
        } else {
          const child = this.data.children[tapIndex - 1]
          this.setData({ selectedChildId: child._openid, selectedChildName: child.nickName })
        }
        this.setData({ page: 1, transactions: [], hasMore: true, loading: true })
        this.loadTransactions()
      }
    })
  },

  // ========== 加载更多 ==========
  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ page: this.data.page + 1, loading: true })
    this.loadTransactions()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, transactions: [], hasMore: true })
    this.loadTransactions().then(() => wx.stopPullDownRefresh())
  }
})
