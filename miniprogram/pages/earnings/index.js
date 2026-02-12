// 账单明细页（全员可见）
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    isParent: false,
    transactions: [],
    loading: true,
    hasMore: true,
    page: 1,
    pageSize: 20,
    // 过滤
    activeFilter: 'all',
    filters: [
      { key: 'all', label: '全部' },
      { key: 'deposit', label: '存入' },
      { key: 'withdraw', label: '取现' },
      { key: 'buy', label: '买入' },
      { key: 'redeem', label: '赎回' }
    ],
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
    this.setData({ userInfo, isParent })

    if (isParent) {
      try {
        const membersRes = await api.callCloud('getFamilyMembers')
        const children = (membersRes.data || []).filter(m => m.role === 'child')
        // 全部 + 各个小孩
        this.setData({ children })
      } catch (err) {
        console.error('获取成员失败:', err)
      }
    }

    this.setData({ page: 1, transactions: [], hasMore: true })
    await this.loadTransactions()
  },

  async loadTransactions() {
    const { page, pageSize, activeFilter, selectedChildId, isParent, userInfo } = this.data

    try {
      const params = { page, pageSize }
      if (activeFilter !== 'all') params.type = activeFilter
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
        this.setData({
          transactions: merged,
          hasMore: newData.length >= pageSize
        })
      }
    } catch (err) {
      console.error('加载账单失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 切换过滤
  onFilterChange(e) {
    const key = e.currentTarget.dataset.key
    this.setData({
      activeFilter: key,
      page: 1,
      transactions: [],
      hasMore: true,
      loading: true
    })
    this.loadTransactions()
  },

  // 家长切换小孩
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

  // 加载更多
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
