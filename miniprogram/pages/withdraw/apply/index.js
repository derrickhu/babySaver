// 取现申请页（小孩 → 从默认账户取现）
const api = require('../../../utils/api')
const util = require('../../../utils/util')

Page({
  data: {
    account: null,
    amount: '',
    remark: '',
    maxAmount: 0,
    submitting: false,
    history: [],
    loading: true
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    if (!this.data.loading) this.loadData()
  },

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
      await api.callCloud('calcAllEarnings', {}).catch(() => {})

      const [accRes, txRes] = await Promise.all([
        api.callCloud('getAccount', {}),
        api.callCloud('getTransactions', { type: 'withdraw', page: 1, pageSize: 20 })
      ])

      if (accRes.code === 0 && accRes.data) {
        const a = accRes.data
        const maxAmount = Math.round((a.balance + a.totalEarnings) * 100) / 100
        this.setData({
          account: {
            ...a,
            balanceStr: util.formatMoney(a.balance),
            earningsStr: util.formatMoney(a.totalEarnings),
            totalStr: util.formatMoney(maxAmount)
          },
          maxAmount
        })
      }

      if (txRes.code === 0) {
        this.setData({
          history: (txRes.data || []).map(t => ({
            ...t,
            amountStr: util.formatMoney(t.amount),
            statusText: util.getStatusText(t.status),
            timeStr: util.relativeTime(t.createdAt)
          }))
        })
      }
    } catch (err) {
      console.error('加载失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  onAmountInput(e) { this.setData({ amount: e.detail.value }) },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }) },

  onTakeAll() {
    this.setData({ amount: String(this.data.maxAmount) })
  },

  async onSubmit() {
    const { amount, remark, maxAmount } = this.data
    const amountNum = parseFloat(amount)

    if (isNaN(amountNum) || amountNum <= 0) return api.showError('请输入正确的取现金额')
    if (amountNum > maxAmount) return api.showError(`最多可取 ¥${maxAmount.toFixed(2)}`)
    if (!remark || !remark.trim()) return api.showError('请填写备注')

    const confirmRes = await new Promise(resolve => {
      wx.showModal({
        title: '确认取现',
        content: `申请取现 ¥${amountNum.toFixed(2)}，提交后需要家长审批。`,
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
        remark: remark.trim()
      })
      api.hideLoading()
      api.showToast(res.msg || '提交成功')
      this.setData({ amount: '', remark: '' })
      this.loadData()
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg || '提交失败')
    } finally {
      this.setData({ submitting: false })
    }
  }
})
