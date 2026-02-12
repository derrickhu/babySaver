// 任务列表页
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    isParent: false,
    activeTab: 'open',
    tabs: [
      { key: 'open', label: '待领取' },
      { key: 'active', label: '进行中' },
      { key: 'done', label: '已完成' }
    ],
    tasks: [],
    loading: true,
    hasMore: true,
    page: 1,
    pageSize: 20
  },

  onLoad() {
    const app = getApp()
    const userInfo = app.globalData.userInfo
    if (userInfo) {
      this.setData({ isParent: userInfo.role === 'parent' })
    }
  },

  onShow() {
    // 设置 Tab 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    // 刷新用户角色
    const app = getApp()
    const userInfo = app.globalData.userInfo
    if (userInfo) {
      this.setData({ isParent: userInfo.role === 'parent' })
    }
    this.refreshList()
  },

  // 刷新列表
  refreshList() {
    this.setData({ page: 1, tasks: [], hasMore: true, loading: true })
    this.loadTasks()
  },

  async loadTasks() {
    const { activeTab, page, pageSize } = this.data
    try {
      const res = await api.callCloud('getTasks', { tab: activeTab, page, pageSize })
      if (res.code === 0) {
        const newData = (res.data || []).map(t => this._formatTask(t))
        const merged = page === 1 ? newData : [...this.data.tasks, ...newData]
        this.setData({
          tasks: merged,
          hasMore: newData.length >= pageSize
        })
      }
    } catch (err) {
      console.error('加载任务失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 格式化任务显示
  _formatTask(t) {
    const now = new Date()
    const deadline = new Date(t.deadline)
    const diffDays = Math.ceil((deadline - now) / 86400000)
    let deadlineText = ''
    let urgent = false
    if (t.status === 'open') {
      if (diffDays <= 0) {
        deadlineText = '今天截止'
        urgent = true
      } else if (diffDays === 1) {
        deadlineText = '明天截止'
        urgent = true
      } else if (diffDays <= 3) {
        deadlineText = `${diffDays}天后截止`
        urgent = true
      } else {
        deadlineText = `${util.formatDate(deadline)} 截止`
      }
    } else {
      deadlineText = `${util.formatDate(deadline)} 截止`
    }

    return {
      ...t,
      rewardStr: util.formatMoney(t.reward),
      deadlineText,
      urgent,
      statusText: this._getStatusText(t.status),
      statusClass: t.status,
      timeStr: util.relativeTime(t.createdAt)
    }
  },

  _getStatusText(status) {
    const map = {
      open: '待领取',
      claimed: '进行中',
      submitted: '待审核',
      approved: '已完成',
      rejected: '未通过',
      expired: '已过期'
    }
    return map[status] || status
  },

  // 切换 Tab
  onTabChange(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.activeTab) return
    this.setData({ activeTab: key })
    this.refreshList()
  },

  // 跳转详情
  onTaskTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/task/detail/index?id=${id}` })
  },

  // 跳转创建
  onCreateTask() {
    wx.navigateTo({ url: '/pages/task/create/index' })
  },

  // 加载更多
  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ page: this.data.page + 1, loading: true })
    this.loadTasks()
  },

  onPullDownRefresh() {
    this.refreshList()
    setTimeout(() => wx.stopPullDownRefresh(), 500)
  }
})
