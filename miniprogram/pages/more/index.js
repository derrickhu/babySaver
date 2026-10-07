const auth = require('../../utils/auth')

Page({
  data: {
    items: [
      { no: '01', title: '留存', desc: '新增用户的次日到30日留存', url: '/pages/retention/index' },
      { no: '02', title: '商业化', desc: '回本决策、用户价值、真实收入录入', url: '/pages/commercial/index' },
      { no: '03', title: '归因', desc: '计划质量、回流和回传', url: '/pages/attribution/index' },
      { no: '04', title: '玩家档案', desc: '云存档每日快照', url: '/pages/snapshot/index' },
      { no: '05', title: '原始事件', desc: '按时间和事件名回看', url: '/pages/events/index' },
      { no: '06', title: '系统运维', desc: '拉取、重算、事件清理', url: '/pages/ops/index' },
    ],
  },

  onShow() {
    auth.selectTab(this, 3)
  },

  open(event) {
    wx.navigateTo({ url: event.currentTarget.dataset.url })
  },
})
