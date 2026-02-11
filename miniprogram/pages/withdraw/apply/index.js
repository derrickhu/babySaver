// 取现申请页（小孩）
const api = require('../../../utils/api')
const util = require('../../../utils/util')

Page({
  data: {
    deposit: null,
    amount: '',
    reason: '',
    maxAmount: 0,
    submitting: false,
    history: [],
    loading: true
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
    if (!userInfo || userInfo.role !== 'child') {
      api.showToast('仅小孩可申请取现')
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }

    try {
      // 先计算收益
      await api.callCloud('calcEarnings', {}).catch(() => {})

      const [depositRes, historyRes] = await Promise.all([
        api.callCloud('getDeposit', {}),
        api.callCloud('getWithdrawals', { page: 1, pageSize: 20 })
      ])

      if (depositRes.code === 0 && depositRes.data) {
        const d = depositRes.data
        const maxAmount = Math.round((d.balance + d.totalEarnings) * 100) / 100
        this.setData({
          deposit: {
            ...d,
            balanceStr: util.formatMoney(d.balance),
            earningsStr: util.formatMoney(d.totalEarnings),
            totalStr: util.formatMoney(maxAmount)
          },
          maxAmount
        })
      }

      if (historyRes.code === 0) {
        this.setData({
          history: (historyRes.data || []).map(w => ({
            ...w,
            amountStr: util.formatMoney(w.amount),
            statusText: util.getStatusText(w.status),
            timeStr: util.relativeTime(w.createdAt)
          }))
        })
      }
    } catch (err) {
      console.error('加载失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 输入金额
  onAmountInput(e) {
    this.setData({ amount: e.detail.value })
  },

  // 输入原因
  onReasonInput(e) {
    this.setData({ reason: e.detail.value })
  },

  // 全部取出
  onTakeAll() {
    this.setData({ amount: String(this.data.maxAmount) })
  },

  // 提交申请
  async onSubmit() {
    const { amount, reason, maxAmount } = this.data
    const amountNum = parseFloat(amount)

    if (isNaN(amountNum) || amountNum <= 0) {
      return api.showToast('请输入正确的取现金额')
    }
    if (amountNum > maxAmount) {
      return api.showToast(`最多可取 ${maxAmount.toFixed(2)} 元`)
    }

    // 确认弹窗
    const confirmRes = await new Promise(resolve => {
      wx.showModal({
        title: '确认取现',
        content: `申请取现 ¥${amountNum.toFixed(2)}，提交后需要家长审批通过。`,
        confirmText: '确认提交',
        success: resolve
      })
    })

    if (!confirmRes.confirm) return

    this.setData({ submitting: true })
    api.showLoading('提交中...')

    try {
      const res = await api.callCloud('applyWithdraw', {
        amount: amountNum,
        reason: reason || ''
      })
      api.hideLoading()
      api.showToast(res.msg || '提交成功')

      // 清空表单并刷新
      this.setData({ amount: '', reason: '' })
      this.loadData()
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg || '提交失败')
    } finally {
      this.setData({ submitting: false })
    }
  }
})
