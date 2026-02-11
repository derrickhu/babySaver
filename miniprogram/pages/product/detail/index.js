// 产品详情 - 查看/买入/赎回
const api = require('../../../utils/api')
const util = require('../../../utils/util')

Page({
  data: {
    product: null,
    investment: null,
    isParent: false,
    isChild: false,
    productId: '',
    investmentId: '',
    buyAmount: '',
    buyEstimate: '',
    loading: true,
    showBuyModal: false,
    accountBalance: 0,
    accountBalanceStr: '0.00'
  },

  onLoad(options) {
    const app = getApp()
    const userInfo = app.globalData.userInfo
    this.setData({
      productId: options.productId || '',
      investmentId: options.investmentId || '',
      isParent: userInfo && userInfo.role === 'parent',
      isChild: userInfo && userInfo.role === 'child'
    })
    this.loadData()
  },

  onShow() {
    if (!this.data.loading) this.loadData()
  },

  async loadData() {
    try {
      const { productId, investmentId, isChild } = this.data

      if (productId) {
        const res = await api.callCloud('getProductDetail', { productId })
        if (res.code === 0 && res.data) {
          const p = res.data
          this.setData({
            product: {
              ...p,
              rateStr: p.rate + '%',
              riskLabel: util.getRiskLabel(p.riskLevel),
              riskColor: util.getRiskColor(p.riskLevel),
              typeLabel: p.type === 'demand' ? '活期' : `定期${p.termDays}天`,
              // 每日收益预估
              dailyEarning1000: (1000 * p.rate / 100 / 365).toFixed(4)
            }
          })
        }
      }

      if (investmentId) {
        const invRes = await api.callCloud('getInvestments', {})
        if (invRes.code === 0) {
          const inv = invRes.data.find(i => i._id === investmentId)
          if (inv) {
            this.setData({
              investment: {
                ...inv,
                amountStr: util.formatMoney(inv.amount),
                earningsStr: util.formatMoney(inv.earnings),
                totalValueStr: util.formatMoney(inv.amount + inv.earnings),
                dailyEarningStr: (inv.amount * inv.rate / 100 / 365).toFixed(4),
                canRedeem: inv.status === 'matured' || (inv.status === 'active' && !inv.endDate)
              }
            })
          }
        }
      }

      if (isChild) {
        const accRes = await api.callCloud('getAccount', {})
        if (accRes.code === 0 && accRes.data) {
          this.setData({
            accountBalance: accRes.data.balance,
            accountBalanceStr: util.formatMoney(accRes.data.balance)
          })
        }
      }
    } catch (err) {
      console.error('加载失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  goEdit() {
    wx.navigateTo({ url: `/pages/product/create/index?productId=${this.data.productId}` })
  },

  goLogs() {
    wx.navigateTo({ url: `/pages/product/logs/index?productId=${this.data.productId}` })
  },

  async toggleStatus() {
    const product = this.data.product
    if (!product) return
    const newStatus = product.status === 'active' ? 'inactive' : 'active'
    const label = newStatus === 'active' ? '上架' : '停售'

    wx.showModal({
      title: '确认',
      content: `确定${label}「${product.name}」？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.callCloud('updateProduct', { productId: product._id, status: newStatus })
            api.showToast(`${label}成功`)
            this.loadData()
          } catch (err) {
            api.showError(err.msg)
          }
        }
      }
    })
  },

  openBuyModal() {
    this.setData({ showBuyModal: true, buyAmount: '', buyEstimate: '' })
  },

  closeBuyModal() {
    this.setData({ showBuyModal: false })
  },

  onBuyAmountInput(e) {
    const val = e.detail.value
    let estimate = ''
    const amt = parseFloat(val)
    if (amt > 0 && this.data.product) {
      estimate = (amt * this.data.product.rate / 100 / 365).toFixed(4)
    }
    this.setData({ buyAmount: val, buyEstimate: estimate })
  },

  async onBuy() {
    const { buyAmount, productId } = this.data
    if (!buyAmount || isNaN(buyAmount) || Number(buyAmount) <= 0) {
      return api.showError('请输入合法金额')
    }

    api.showLoading('买入中...')
    try {
      const res = await api.callCloud('buyProduct', {
        productId,
        amount: Number(buyAmount)
      })
      api.showToast(res.msg || '买入成功')
      this.setData({ showBuyModal: false })
      setTimeout(() => this.loadData(), 1000)
    } catch (err) {
      api.showError(err.msg)
    } finally {
      api.hideLoading()
    }
  },

  async onRedeem() {
    const { investmentId, investment } = this.data
    if (!investmentId || !investment) return

    wx.showModal({
      title: '确认赎回',
      content: `将赎回 ¥${investment.totalValueStr}（本金+收益）到默认账户`,
      confirmText: '确认赎回',
      success: async (res) => {
        if (!res.confirm) return
        api.showLoading('赎回中...')
        try {
          const result = await api.callCloud('redeemInvestment', { investmentId })
          api.showToast(result.msg || '赎回成功')
          setTimeout(() => wx.navigateBack(), 1500)
        } catch (err) {
          api.showError(err.msg)
        } finally {
          api.hideLoading()
        }
      }
    })
  }
})
