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
    redeemRemark: '',
    loading: true,
    showBuyModal: false,
    showRedeemModal: false,
    buyRemark: '',
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

  async loadData() {
    try {
      const { productId, investmentId, isChild } = this.data

      // 加载产品详情
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
              typeLabel: p.type === 'demand' ? '活期' : `定期${p.termDays}天`
            }
          })
        }
      }

      // 如果有投资ID，加载投资信息
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
                canRedeem: inv.status === 'matured' || (inv.status === 'active' && !inv.endDate)
              }
            })
          }
        }
      }

      // 小孩：加载默认账户余额
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

  // 编辑产品（家长）
  goEdit() {
    wx.navigateTo({ url: `/pages/product/create/index?productId=${this.data.productId}` })
  },

  // 停售/上架产品（家长）
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

  // 打开买入弹窗（小孩）
  openBuyModal() {
    this.setData({ showBuyModal: true, buyAmount: '', buyRemark: '' })
  },

  closeBuyModal() {
    this.setData({ showBuyModal: false })
  },

  onBuyAmountInput(e) {
    this.setData({ buyAmount: e.detail.value })
  },

  onBuyRemarkInput(e) {
    this.setData({ buyRemark: e.detail.value })
  },

  async onBuy() {
    const { buyAmount, buyRemark, productId } = this.data
    if (!buyAmount || isNaN(buyAmount) || Number(buyAmount) <= 0) {
      return api.showError('请输入合法金额')
    }
    if (!buyRemark.trim()) return api.showError('请填写备注')

    api.showLoading('买入中...')
    try {
      const res = await api.callCloud('buyProduct', {
        productId,
        amount: Number(buyAmount),
        remark: buyRemark.trim()
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

  // 打开赎回弹窗
  openRedeemModal() {
    this.setData({ showRedeemModal: true, redeemRemark: '' })
  },

  closeRedeemModal() {
    this.setData({ showRedeemModal: false })
  },

  onRedeemRemarkInput(e) {
    this.setData({ redeemRemark: e.detail.value })
  },

  async onRedeem() {
    const { redeemRemark, investmentId } = this.data
    if (!redeemRemark.trim()) return api.showError('请填写备注')

    api.showLoading('赎回中...')
    try {
      const res = await api.callCloud('redeemInvestment', {
        investmentId,
        remark: redeemRemark.trim()
      })
      api.showToast(res.msg || '赎回成功')
      this.setData({ showRedeemModal: false })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (err) {
      api.showError(err.msg)
    } finally {
      api.hideLoading()
    }
  }
})
