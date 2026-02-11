// 产品操作日志页
const api = require('../../../utils/api')
const util = require('../../../utils/util')

Page({
  data: {
    productId: '',
    logs: [],
    loading: true,
    hasMore: true,
    page: 1
  },

  onLoad(options) {
    this.setData({ productId: options.productId || '' })
    this.loadLogs()
  },

  async loadLogs() {
    try {
      const res = await api.callCloud('getProductLogs', {
        productId: this.data.productId,
        page: this.data.page,
        pageSize: 30
      })
      if (res.code === 0) {
        const newLogs = (res.data || []).map(l => ({
          ...l,
          timeStr: util.formatDateTime(l.createdAt),
          actionLabel: this.getActionLabel(l.action),
          actionColor: this.getActionColor(l.action)
        }))
        const merged = this.data.page === 1 ? newLogs : [...this.data.logs, ...newLogs]
        this.setData({
          logs: merged,
          hasMore: newLogs.length >= 30
        })
      }
    } catch (err) {
      console.error('加载日志失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  getActionLabel(action) {
    const map = {
      create: '创建',
      update: '修改',
      offline: '下线',
      online: '上线'
    }
    return map[action] || action
  },

  getActionColor(action) {
    const map = {
      create: '#07c160',
      update: '#4a7cf7',
      offline: '#ff4d4f',
      online: '#07c160'
    }
    return map[action] || '#999'
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ page: this.data.page + 1, loading: true })
    this.loadLogs()
  }
})
