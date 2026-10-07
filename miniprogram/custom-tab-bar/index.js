Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/home/index', text: '总览' },
      { pagePath: '/pages/dashboard/index', text: '大盘' },
      { pagePath: '/pages/gameplay/index', text: '玩法' },
      { pagePath: '/pages/more/index', text: '更多' },
    ],
  },
  methods: {
    onTap(event) {
      const index = Number(event.currentTarget.dataset.index)
      const item = this.data.list[index]
      if (!item || index === this.data.selected) return
      wx.switchTab({ url: item.pagePath })
    },
  },
})
