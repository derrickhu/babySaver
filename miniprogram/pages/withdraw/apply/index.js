// 取现申请页（小孩 → 从默认账户取现）
const api = require('../../../utils/api')
const util = require('../../../utils/util')

Page({
  data: {
    account: null,
    amount: '',
    remark: '',
    selectedTag: '',
    maxAmount: 0,
    submitting: false,
    history: [],
    loading: true,
    // 取现用途标签（适合小朋友的消费场景）
    withdrawTags: [
      { key: 'snack', icon: '🍭', label: '零食' },
      { key: 'toy', icon: '🧸', label: '玩具' },
      { key: 'book', icon: '📖', label: '书籍' },
      { key: 'stationery', icon: '✏️', label: '文具' },
      { key: 'clothing', icon: '👕', label: '衣服' },
      { key: 'travel', icon: '🎡', label: '游玩' },
      { key: 'movie', icon: '🎬', label: '电影' },
      { key: 'sports', icon: '⚽', label: '运动' },
      { key: 'gift_buy', icon: '🎁', label: '买礼物' },
      { key: 'other', icon: '📝', label: '其他' }
    ]
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
            timeStr: util.relativeTime(t.createdAt),
            tagLabel: t.tag ? util.getTagLabel(t.type, t.tag) : '',
            tagIcon: t.tag ? util.getTagIcon(t.type, t.tag) : ''
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

  // 选择标签
  onSelectTag(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ selectedTag: this.data.selectedTag === key ? '' : key })
  },

  onTakeAll() {
    this.setData({ amount: String(this.data.maxAmount) })
  },

  async onSubmit() {
    const { amount, remark, maxAmount, selectedTag } = this.data
    const amountNum = parseFloat(amount)

    if (isNaN(amountNum) || amountNum <= 0) return api.showError('请输入正确的取现金额')
    if (amountNum > maxAmount) return api.showError(`最多可取 ¥${maxAmount.toFixed(2)}`)
    if (!selectedTag) return api.showError('请选择用途')

    // 必须在 tap 同步调用栈中第一时间调用，不能有 await 在前面！
    await api.requestSubscribe([api.TMPL_REVIEW])

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

    // 自动生成备注：标签名 + 用户补充
    const tagItem = this.data.withdrawTags.find(t => t.key === selectedTag)
    const tagLabel = tagItem ? tagItem.label : ''
    const finalRemark = remark && remark.trim() ? `${tagLabel} - ${remark.trim()}` : tagLabel

    try {
      const res = await api.callCloud('applyWithdraw', {
        amount: amountNum,
        remark: finalRemark,
        tag: selectedTag
      })
      api.hideLoading()
      api.showToast(res.msg || '提交成功')
      this.setData({ amount: '', remark: '', selectedTag: '' })
      this.loadData()
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg || '提交失败')
    } finally {
      this.setData({ submitting: false })
    }
  }
})
