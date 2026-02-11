// 存款设置页（家长专属）
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    childOpenId: '',
    childName: '',
    currentDeposit: null,
    principal: '',
    rate: '',
    estimateDaily: '0.0000',
    estimateMonthly: '0.00',
    estimateYearly: '0.00',
    loading: true,
    saving: false,
    children: [],
    selectedChildIndex: -1
  },

  onLoad(options) {
    const childOpenId = options.childOpenId || ''
    this.setData({ childOpenId })
    this.loadData(childOpenId)
  },

  // 加载数据
  async loadData(childOpenId) {
    const app = getApp()
    const userInfo = app.globalData.userInfo

    if (!userInfo || userInfo.role !== 'parent') {
      api.showToast('仅家长可操作')
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }

    try {
      // 获取家庭成员
      const membersRes = await api.callCloud('getFamilyMembers')
      const children = (membersRes.data || []).filter(m => m.role === 'child')
      this.setData({ children })

      if (children.length === 0) {
        this.setData({ loading: false })
        return
      }

      // 如果没有指定小孩，默认选第一个
      let targetChildId = childOpenId
      let selectedIndex = 0
      if (targetChildId) {
        selectedIndex = children.findIndex(c => c._openid === targetChildId)
        if (selectedIndex === -1) selectedIndex = 0
      }
      targetChildId = children[selectedIndex]._openid

      this.setData({
        childOpenId: targetChildId,
        childName: children[selectedIndex].nickName,
        selectedChildIndex: selectedIndex
      })

      // 获取当前存款
      await this.loadDeposit(targetChildId)
    } catch (err) {
      console.error('加载失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载存款
  async loadDeposit(childOpenId) {
    try {
      const depositRes = await api.callCloud('getDeposit', { childOpenId })
      if (depositRes.code === 0 && depositRes.data) {
        const d = depositRes.data
        const principal = String(d.principal)
        const rate = String(d.rate)
        this.setData({
          currentDeposit: d,
          principal,
          rate
        })
        this.updateEstimate(principal, rate)
      } else {
        this.setData({
          currentDeposit: null,
          principal: '',
          rate: '',
          estimateDaily: '0.0000',
          estimateMonthly: '0.00',
          estimateYearly: '0.00'
        })
      }
    } catch (err) {
      console.error('加载存款失败:', err)
    }
  },

  // 切换小孩
  onChildChange(e) {
    const index = e.detail.value
    const child = this.data.children[index]
    this.setData({
      selectedChildIndex: index,
      childOpenId: child._openid,
      childName: child.nickName
    })
    this.loadDeposit(child._openid)
  },

  // 输入本金
  onPrincipalInput(e) {
    const principal = e.detail.value
    this.setData({ principal })
    this.updateEstimate(principal, this.data.rate)
  },

  // 输入利率
  onRateInput(e) {
    const rate = e.detail.value
    this.setData({ rate })
    this.updateEstimate(this.data.principal, rate)
  },

  // 更新收益预估（WXML 不支持 .toFixed，需在 JS 中计算）
  updateEstimate(principal, rate) {
    const p = parseFloat(principal) || 0
    const r = parseFloat(rate) || 0
    const estimateDaily = p && r ? (p * r / 100 / 365).toFixed(4) : '0.0000'
    const estimateMonthly = p && r ? (p * r / 100 / 12).toFixed(2) : '0.00'
    const estimateYearly = p && r ? (p * r / 100).toFixed(2) : '0.00'
    this.setData({ estimateDaily, estimateMonthly, estimateYearly })
  },

  // 保存存款设置
  async onSave() {
    const { childOpenId, principal, rate } = this.data
    const principalNum = parseFloat(principal)
    const rateNum = parseFloat(rate)

    if (!childOpenId) {
      return api.showToast('请选择小孩')
    }
    if (isNaN(principalNum) || principalNum < 0) {
      return api.showToast('请输入正确的本金金额')
    }
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      return api.showToast('利率请填写0-100之间的数字')
    }

    this.setData({ saving: true })
    api.showLoading('保存中...')

    try {
      const res = await api.callCloud('setDeposit', {
        childOpenId,
        principal: principalNum,
        rate: rateNum
      })
      api.hideLoading()
      api.showToast(res.msg || '保存成功')

      // 重新加载
      await this.loadDeposit(childOpenId)
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg || '保存失败')
    } finally {
      this.setData({ saving: false })
    }
  }
})
