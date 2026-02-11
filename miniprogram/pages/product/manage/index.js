// 理财产品管理页
const api = require('../../../utils/api')
const util = require('../../../utils/util')

Page({
  data: {
    isParent: false,
    products: [],
    loading: true
  },

  onLoad() {
    const app = getApp()
    const userInfo = app.globalData.userInfo
    this.setData({ isParent: userInfo && userInfo.role === 'parent' })
    this.loadProducts()
  },

  onShow() {
    this.loadProducts()
  },

  async loadProducts() {
    try {
      const res = await api.callCloud('getProducts')
      if (res.code === 0) {
        const products = (res.data || []).filter(p => p.status === 'active').map(p => ({
          ...p,
          rateStr: p.rate + '%',
          riskLabel: util.getRiskLabel(p.riskLevel),
          riskColor: util.getRiskColor(p.riskLevel)
        }))
        this.setData({ products })
      }
    } catch (err) {
      console.error('加载产品失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/product/create/index' })
  },

  goDetail(e) {
    const productId = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/product/detail/index?productId=${productId}` })
  },

  onPullDownRefresh() {
    this.loadProducts().then(() => wx.stopPullDownRefresh())
  }
})
