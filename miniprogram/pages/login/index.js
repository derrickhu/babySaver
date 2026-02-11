// 登录注册页
const api = require('../../utils/api')

Page({
  data: {
    nickName: '',
    role: '', // 'parent' 或 'child'
    loading: false
  },

  // 输入昵称
  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value.trim() })
  },

  // 选择角色
  onSelectRole(e) {
    this.setData({ role: e.currentTarget.dataset.role })
  },

  // 提交注册
  async onRegister() {
    const { nickName, role } = this.data
    if (!nickName) {
      return api.showToast('请输入昵称')
    }
    if (!role) {
      return api.showToast('请选择身份')
    }

    this.setData({ loading: true })
    api.showLoading('注册中...')

    try {
      const res = await api.callCloud('register', { nickName, role })
      api.hideLoading()
      api.showToast('注册成功')

      // 更新全局用户信息
      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      app.globalData.userInfo = userRes.data
      app.globalData.isLoggedIn = true

      // 跳转到家庭管理页
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/family/index' })
      }, 800)
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg || '注册失败')
    } finally {
      this.setData({ loading: false })
    }
  }
})
