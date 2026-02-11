// 取现审批页（家长专属）
const api = require('../../../utils/api')
const util = require('../../../utils/util')

Page({
  data: {
    activeTab: 'pending',
    pendingList: [],
    historyList: [],
    loading: true,
    processing: false
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
    if (!userInfo || userInfo.role !== 'parent') {
      api.showToast('仅家长可审批')
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }

    try {
      const [pendingRes, historyRes] = await Promise.all([
        api.callCloud('getWithdrawals', { status: 'pending' }),
        api.callCloud('getWithdrawals', {})
      ])

      this.setData({
        pendingList: (pendingRes.data || []).map(w => this.formatWithdrawal(w)),
        historyList: (historyRes.data || [])
          .filter(w => w.status !== 'pending')
          .map(w => this.formatWithdrawal(w))
      })
    } catch (err) {
      console.error('加载失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 格式化取现记录
  formatWithdrawal(w) {
    return {
      ...w,
      amountStr: util.formatMoney(w.amount),
      statusText: util.getStatusText(w.status),
      timeStr: util.formatDateTime(w.createdAt),
      reviewTimeStr: w.reviewedAt ? util.formatDateTime(w.reviewedAt) : ''
    }
  },

  // 切换Tab
  onTabChange(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  // 审批通过
  async onApprove(e) {
    const withdrawId = e.currentTarget.dataset.id
    const item = this.data.pendingList.find(w => w._id === withdrawId)

    const confirmRes = await new Promise(resolve => {
      wx.showModal({
        title: '确认通过',
        content: `通过 ${item.childName} 的取现申请 ¥${item.amountStr}？通过后将从存款中扣减对应金额。`,
        confirmText: '通过',
        confirmColor: '#52C41A',
        success: resolve
      })
    })

    if (!confirmRes.confirm) return

    this.setData({ processing: true })
    api.showLoading('处理中...')

    try {
      const res = await api.callCloud('reviewWithdraw', {
        withdrawId,
        action: 'approve'
      })
      api.hideLoading()
      api.showToast(res.msg || '已通过')
      this.loadData()
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg || '操作失败')
    } finally {
      this.setData({ processing: false })
    }
  },

  // 审批拒绝
  async onReject(e) {
    const withdrawId = e.currentTarget.dataset.id
    const item = this.data.pendingList.find(w => w._id === withdrawId)

    const confirmRes = await new Promise(resolve => {
      wx.showModal({
        title: '确认拒绝',
        content: `拒绝 ${item.childName} 的取现申请 ¥${item.amountStr}？`,
        confirmText: '拒绝',
        confirmColor: '#FF4D4F',
        success: resolve
      })
    })

    if (!confirmRes.confirm) return

    this.setData({ processing: true })
    api.showLoading('处理中...')

    try {
      const res = await api.callCloud('reviewWithdraw', {
        withdrawId,
        action: 'reject'
      })
      api.hideLoading()
      api.showToast(res.msg || '已拒绝')
      this.loadData()
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg || '操作失败')
    } finally {
      this.setData({ processing: false })
    }
  }
})
