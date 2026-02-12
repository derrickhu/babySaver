// 任务详情页
const api = require('../../../utils/api')
const util = require('../../../utils/util')

Page({
  data: {
    task: null,
    loading: true,
    isParent: false,
    isChild: false,
    myOpenId: '',
    processing: false
  },

  onLoad(options) {
    this.taskId = options.id
    const app = getApp()
    const userInfo = app.globalData.userInfo
    if (userInfo) {
      this.setData({
        isParent: userInfo.role === 'parent',
        isChild: userInfo.role === 'child',
        myOpenId: userInfo.openid || ''
      })
    }
  },

  onShow() {
    this.loadDetail()
  },

  async loadDetail() {
    try {
      const res = await api.callCloud('getTaskDetail', { taskId: this.taskId })
      if (res.code === 0 && res.data) {
        const t = res.data
        const deadline = new Date(t.deadline)
        const now = new Date()
        const diffDays = Math.ceil((deadline - now) / 86400000)

        const isMyTask = t.createdBy === this.data.myOpenId
        this.setData({
          task: {
            ...t,
            rewardStr: util.formatMoney(t.reward),
            deadlineStr: util.formatDate(deadline),
            createdAtStr: util.formatDateTime(t.createdAt),
            submittedAtStr: t.submittedAt ? util.formatDateTime(t.submittedAt) : '',
            reviewedAtStr: t.reviewedAt ? util.formatDateTime(t.reviewedAt) : '',
            remainDays: diffDays > 0 ? diffDays : 0,
            isExpiredSoon: diffDays <= 3 && diffDays > 0 && t.status === 'open',
            isMyClaim: t.claimedBy === this.data.myOpenId,
            isMyTask,
            canEdit: isMyTask && ['open', 'claimed'].includes(t.status),
            canDelete: isMyTask && ['open', 'expired', 'rejected'].includes(t.status)
          }
        })
      }
    } catch (err) {
      console.error('加载详情失败:', err)
      api.showError(err.msg || '加载失败')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 小孩认领
  async onClaim() {
    const res = await new Promise(resolve => {
      wx.showModal({
        title: '确认认领',
        content: `认领后需要在截止日期前完成哦，奖金 ¥${this.data.task.rewardStr}`,
        confirmText: '认领',
        success: resolve
      })
    })
    if (!res.confirm) return

    this.setData({ processing: true })
    try {
      const r = await api.callCloud('claimTask', { taskId: this.taskId })
      api.showToast(r.msg || '认领成功')
      this.loadDetail()
    } catch (err) {
      api.showError(err.msg || '认领失败')
    } finally {
      this.setData({ processing: false })
    }
  },

  // 小孩提交完成
  async onSubmit() {
    const res = await new Promise(resolve => {
      wx.showModal({
        title: '提交确认',
        content: '确认已完成任务？提交后等待家长审核',
        confirmText: '提交',
        success: resolve
      })
    })
    if (!res.confirm) return

    this.setData({ processing: true })
    try {
      const r = await api.callCloud('submitTask', { taskId: this.taskId })
      api.showToast(r.msg || '提交成功')
      this.loadDetail()
    } catch (err) {
      api.showError(err.msg || '提交失败')
    } finally {
      this.setData({ processing: false })
    }
  },

  // 家长审核 - 通过
  async onApprove() {
    const task = this.data.task
    const res = await new Promise(resolve => {
      wx.showModal({
        title: '确认通过',
        content: `通过后将自动发放 ¥${task.rewardStr} 到 ${task.claimerName} 的账户`,
        confirmText: '通过',
        success: resolve
      })
    })
    if (!res.confirm) return

    this.setData({ processing: true })
    try {
      const r = await api.callCloud('reviewTask', { taskId: this.taskId, action: 'approve' })
      api.showToast(r.msg || '已通过')
      this.loadDetail()
    } catch (err) {
      api.showError(err.msg || '操作失败')
    } finally {
      this.setData({ processing: false })
    }
  },

  // 家长审核 - 拒绝
  async onReject() {
    const res = await new Promise(resolve => {
      wx.showModal({
        title: '确认拒绝',
        content: '拒绝后小孩不会获得奖金，确认拒绝？',
        confirmText: '拒绝',
        confirmColor: '#ff4d4f',
        success: resolve
      })
    })
    if (!res.confirm) return

    this.setData({ processing: true })
    try {
      const r = await api.callCloud('reviewTask', { taskId: this.taskId, action: 'reject' })
      api.showToast(r.msg || '已拒绝')
      this.loadDetail()
    } catch (err) {
      api.showError(err.msg || '操作失败')
    } finally {
      this.setData({ processing: false })
    }
  },

  // 发布者编辑任务
  onEdit() {
    wx.navigateTo({
      url: `/pages/task/create/index?id=${this.taskId}`
    })
  },

  // 发布者删除任务
  async onDelete() {
    const res = await new Promise(resolve => {
      wx.showModal({
        title: '删除确认',
        content: '删除后不可恢复，确认删除此任务？',
        confirmText: '删除',
        confirmColor: '#ff4d4f',
        success: resolve
      })
    })
    if (!res.confirm) return

    this.setData({ processing: true })
    try {
      const r = await api.callCloud('deleteTask', { taskId: this.taskId })
      api.showToast(r.msg || '已删除')
      setTimeout(() => wx.navigateBack(), 800)
    } catch (err) {
      api.showError(err.msg || '删除失败')
    } finally {
      this.setData({ processing: false })
    }
  }
})
