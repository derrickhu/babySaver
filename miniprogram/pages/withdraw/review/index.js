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

  // 待审批列表头像加载失败
  onPendingAvatarError(e) {
    const idx = e.currentTarget.dataset.index
    const list = this.data.pendingList.slice()
    if (list[idx]) {
      list[idx] = { ...list[idx], avatarError: true }
      this.setData({ pendingList: list })
    }
  },

  // 历史列表头像加载失败
  onHistoryAvatarError(e) {
    const idx = e.currentTarget.dataset.index
    const list = this.data.historyList.slice()
    if (list[idx]) {
      list[idx] = { ...list[idx], avatarError: true }
      this.setData({ historyList: list })
    }
  },

  onShow() {
    if (!this.data.loading) this.loadData()
  },

  async loadData() {
    const app = getApp()
    const userInfo = app.globalData.userInfo
    if (!userInfo || userInfo.role !== 'parent') {
      api.showToast('仅家长可审批')
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }

    try {
      const [pendingRes, allRes] = await Promise.all([
        api.callCloud('getTransactions', { type: 'withdraw', page: 1, pageSize: 50 }),
        api.callCloud('getTransactions', { type: 'withdraw', page: 1, pageSize: 50 })
      ])

      const allTx = allRes.data || []

      let pendingList = allTx.filter(t => t.status === 'pending').map(t => this.formatTx(t))
      let historyList = allTx.filter(t => t.status !== 'pending').map(t => this.formatTx(t))
      // 将 cloud:// fileID 转为临时 HTTPS URL
      pendingList = await api.resolveAvatars(pendingList, 'childAvatarUrl')
      historyList = await api.resolveAvatars(historyList, 'childAvatarUrl')

      this.setData({ pendingList, historyList })
    } catch (err) {
      console.error('加载失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  formatTx(t) {
    return {
      ...t,
      amountStr: util.formatMoney(t.amount),
      statusText: util.getStatusText(t.status),
      timeStr: util.formatDateTime(t.createdAt),
      reviewTimeStr: t.reviewedAt ? util.formatDateTime(t.reviewedAt) : ''
    }
  },

  onTabChange(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  // 在用户tap时请求订阅「待办事项提醒」（接收未来取现申请通知）
  async _requestSubscribe() {
    try {
      const subRes = await api.callCloud('requestSubscribe', {})
      const tmplIds = subRes.data && subRes.data.templateIds
      if (tmplIds && tmplIds.length > 0) {
        await new Promise(resolve => {
          wx.requestSubscribeMessage({ tmplIds, complete: resolve })
        })
      }
    } catch (e) {}
  },

  async onApprove(e) {
    const txId = e.currentTarget.dataset.id
    const item = this.data.pendingList.find(t => t._id === txId)

    // 在tap事件中请求订阅
    await this._requestSubscribe()

    const confirmRes = await new Promise(resolve => {
      wx.showModal({
        title: '确认通过',
        content: `通过 ${item.childName || '小孩'} 的取现申请 ¥${item.amountStr}？通过后将从默认账户扣减。`,
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
        transactionId: txId,
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

  async onReject(e) {
    const txId = e.currentTarget.dataset.id
    const item = this.data.pendingList.find(t => t._id === txId)

    await this._requestSubscribe()

    const confirmRes = await new Promise(resolve => {
      wx.showModal({
        title: '确认拒绝',
        content: `拒绝 ${item.childName || '小孩'} 的取现申请 ¥${item.amountStr}？`,
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
        transactionId: txId,
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
