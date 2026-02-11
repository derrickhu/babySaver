// 权限管理页（仅创建者可操作）
const api = require('../../../utils/api')

Page({
  data: {
    parents: [],
    isCreator: false,
    loading: true,
    permLabels: {
      deposit: '存入',
      withdrawReview: '取现审批',
      productManage: '产品管理'
    },
    permTypes: ['deposit', 'withdrawReview', 'productManage']
  },

  onLoad() {
    this.loadPermissions()
  },

  onShow() {
    if (!this.data.loading) this.loadPermissions()
  },

  async loadPermissions() {
    try {
      const res = await api.callCloud('getPermissions')
      if (res.code === 0 && res.data) {
        this.setData({
          parents: res.data.parents || [],
          isCreator: res.data.isCreator
        })
      }
    } catch (err) {
      console.error('加载权限失败:', err)
      api.showError(err.msg || '加载失败')
    } finally {
      this.setData({ loading: false })
    }
  },

  async onTogglePerm(e) {
    const { openid, perm, enabled } = e.currentTarget.dataset
    if (!openid || !perm) return

    const newEnabled = !enabled
    const parent = this.data.parents.find(p => p.openid === openid)
    if (!parent) return

    // 不能修改创建者权限
    if (parent.isCreator) {
      return api.showToast('创建者始终拥有全部权限')
    }

    const permLabel = this.data.permLabels[perm]
    const action = newEnabled ? '授权' : '取消'

    wx.showModal({
      title: '确认操作',
      content: `${action}「${parent.nickName}」的「${permLabel}」权限？`,
      success: async (modalRes) => {
        if (!modalRes.confirm) return

        api.showLoading('处理中...')
        try {
          const res = await api.callCloud('updatePermissions', {
            targetOpenId: openid,
            permType: perm,
            enabled: newEnabled
          })
          api.showToast(res.msg || '操作成功')
          this.loadPermissions()
        } catch (err) {
          api.showError(err.msg || '操作失败')
        } finally {
          api.hideLoading()
        }
      }
    })
  }
})
