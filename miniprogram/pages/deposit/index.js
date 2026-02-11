// 存入页（家长 → 小孩默认账户）
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    children: [],
    selectedChildIndex: 0,
    childOpenId: '',
    childName: '',
    amount: '',
    remark: '',
    accountBalance: '0.00',
    submitting: false,
    loading: true
  },

  onLoad(options) {
    this.loadData(options.childOpenId || '')
  },

  async loadData(targetChildId) {
    const app = getApp()
    const userInfo = app.globalData.userInfo
    if (!userInfo || userInfo.role !== 'parent') {
      api.showToast('仅家长可操作')
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }

    try {
      const membersRes = await api.callCloud('getFamilyMembers')
      const children = (membersRes.data || []).filter(m => m.role === 'child')
      this.setData({ children })

      if (children.length === 0) {
        this.setData({ loading: false })
        return
      }

      let selectedIndex = 0
      if (targetChildId) {
        selectedIndex = children.findIndex(c => c._openid === targetChildId)
        if (selectedIndex === -1) selectedIndex = 0
      }

      const child = children[selectedIndex]
      this.setData({
        selectedChildIndex: selectedIndex,
        childOpenId: child._openid,
        childName: child.nickName
      })

      await this.loadAccount(child._openid)
    } catch (err) {
      console.error('加载失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadAccount(childOpenId) {
    try {
      const res = await api.callCloud('getAccount', { childOpenId })
      if (res.code === 0 && res.data) {
        this.setData({
          accountBalance: util.formatMoney(res.data.balance)
        })
      }
    } catch (err) { /* ignore */ }
  },

  onChildChange(e) {
    const index = e.detail.value
    const child = this.data.children[index]
    this.setData({
      selectedChildIndex: parseInt(index),
      childOpenId: child._openid,
      childName: child.nickName
    })
    this.loadAccount(child._openid)
  },

  onAmountInput(e) { this.setData({ amount: e.detail.value }) },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }) },

  async onSubmit() {
    const { childOpenId, amount, remark } = this.data
    const amountNum = parseFloat(amount)

    if (!childOpenId) return api.showError('请选择小孩')
    if (isNaN(amountNum) || amountNum <= 0) return api.showError('请输入正确的金额')
    if (!remark || !remark.trim()) return api.showError('请填写备注')

    this.setData({ submitting: true })
    api.showLoading('存入中...')

    try {
      const res = await api.callCloud('depositToAccount', {
        childOpenId,
        amount: amountNum,
        remark: remark.trim()
      })
      api.hideLoading()
      api.showToast(res.msg || '存入成功')
      this.setData({ amount: '', remark: '' })
      this.loadAccount(childOpenId)
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg || '存入失败')
    } finally {
      this.setData({ submitting: false })
    }
  }
})
