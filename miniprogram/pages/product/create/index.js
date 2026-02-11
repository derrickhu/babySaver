// 创建/编辑理财产品
const api = require('../../../utils/api')

Page({
  data: {
    isEdit: false,
    productId: '',
    name: '',
    riskLevelIndex: 0,
    riskLevels: ['low', 'medium', 'high'],
    riskLabels: ['低风险', '中风险', '高风险'],
    typeIndex: 0,
    types: ['demand', 'fixed'],
    typeLabels: ['活期', '定期'],
    rate: '',
    termDays: '',
    minAmount: '',
    description: '',
    submitting: false,
    exampleText: ''
  },

  onLoad(options) {
    if (options.productId) {
      this.setData({ isEdit: true, productId: options.productId })
      wx.setNavigationBarTitle({ title: '编辑理财产品' })
      this.loadProduct(options.productId)
    }
  },

  async loadProduct(productId) {
    try {
      const res = await api.callCloud('getProductDetail', { productId })
      if (res.code === 0 && res.data) {
        const p = res.data
        this.setData({
          name: p.name,
          riskLevelIndex: this.data.riskLevels.indexOf(p.riskLevel),
          typeIndex: this.data.types.indexOf(p.type),
          rate: String(p.rate),
          termDays: p.termDays ? String(p.termDays) : '',
          minAmount: p.minAmount ? String(p.minAmount) : '',
          description: p.description ? p.description.split('\n').filter(l => !l.startsWith('例：')).join('\n').trim() : ''
        })
        this.updateExample()
      }
    } catch (err) {
      api.showError(err.msg)
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onRateInput(e) {
    this.setData({ rate: e.detail.value })
    this.updateExample()
  },
  onTermDaysInput(e) {
    this.setData({ termDays: e.detail.value })
    this.updateExample()
  },
  onMinAmountInput(e) { this.setData({ minAmount: e.detail.value }) },
  onDescInput(e) { this.setData({ description: e.detail.value }) },

  updateExample() {
    const r = parseFloat(this.data.rate) || 0
    const type = this.data.types[this.data.typeIndex]
    const td = parseInt(this.data.termDays) || 0
    if (r <= 0) {
      this.setData({ exampleText: '' })
      return
    }
    const daily = (1000 * r / 100 / 365).toFixed(4)
    const monthly = (1000 * r / 100 / 12).toFixed(2)
    let text = `存入1000元，每天收益约${daily}元，每月约${monthly}元`
    if (type === 'fixed' && td > 0) {
      const total = (1000 * r / 100 / 365 * td).toFixed(2)
      text += `，${td}天到期总收益约${total}元`
    }
    this.setData({ exampleText: text })
  },

  onRiskChange(e) {
    this.setData({ riskLevelIndex: e.detail.value })
  },

  onTypeChange(e) {
    this.setData({ typeIndex: e.detail.value })
    this.updateExample()
  },

  async onSubmit() {
    const { name, riskLevelIndex, typeIndex, rate, termDays, minAmount, description, isEdit, productId } = this.data
    if (!name.trim()) return api.showError('请输入产品名称')
    if (!rate || isNaN(rate) || Number(rate) < 0) return api.showError('请输入合法利率')

    const type = this.data.types[typeIndex]
    if (type === 'fixed' && (!termDays || isNaN(termDays) || Number(termDays) <= 0)) {
      return api.showError('定期产品请设置投资天数')
    }

    this.setData({ submitting: true })
    api.showLoading(isEdit ? '更新中...' : '创建中...')

    try {
      const params = {
        name: name.trim(),
        riskLevel: this.data.riskLevels[riskLevelIndex],
        type,
        rate: Number(rate),
        termDays: type === 'fixed' ? Number(termDays) : 0,
        minAmount: minAmount ? Number(minAmount) : 0,
        description: description.trim()
      }

      if (isEdit) {
        params.productId = productId
        await api.callCloud('updateProduct', params)
        api.showToast('更新成功')
      } else {
        await api.callCloud('createProduct', params)
        api.showToast('创建成功')
      }

      setTimeout(() => wx.navigateBack(), 1500)
    } catch (err) {
      api.showError(err.msg || '操作失败')
    } finally {
      api.hideLoading()
      this.setData({ submitting: false })
    }
  }
})
