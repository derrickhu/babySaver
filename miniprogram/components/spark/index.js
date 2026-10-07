const { drawSpark, nearest } = require('../../utils/curve')
const { formatYuan } = require('../../utils/format')

Component({
  properties: {
    values: { type: Array, value: [] },
    labels: { type: Array, value: [] },
    color: { type: String, value: '#1F4B99' },
    active: { type: Number, value: -1 },
  },

  data: { tip: '' },

  lifetimes: {
    ready() {
      this._ready = true
      this.syncTip()
      this.draw()
    },
  },

  observers: {
    'values, labels, color, active': function observe() {
      this.syncTip()
      if (this._ready) this.draw()
    },
  },

  methods: {
    syncTip() {
      const active = this.data.active
      if (active == null || active < 0) {
        if (this.data.tip) this.setData({ tip: '' })
        return
      }
      const label = (this.data.labels || [])[active] || ''
      const value = formatYuan((this.data.values || [])[active] || 0)
      const tip = label ? `${label}  ¥${value}` : `¥${value}`
      if (tip !== this.data.tip) this.setData({ tip })
    },

    draw(retry) {
      const values = this.data.values || []
      const color = this.data.color || '#1F4B99'
      const query = this.createSelectorQuery()
      query.select('#spark').fields({ node: true, size: true }).exec((res) => {
        const info = res && res[0]
        if (!info || !info.node || !info.width || !info.height) {
          if (!retry) setTimeout(() => this.draw(true), 60)
          return
        }
        const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2
        const canvas = info.node
        const ctx = canvas.getContext('2d')
        canvas.width = Math.round(info.width * dpr)
        canvas.height = Math.round(info.height * dpr)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        this._plot = drawSpark(ctx, info.width, info.height, values, color, this.data.active)
      })
    },

    onTouch(event) {
      const touch = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0])
      if (!touch || !this._plot || !this._plot.xs.length || typeof touch.x !== 'number') return
      const index = nearest(this._plot.xs, touch.x)
      if (index === this.data.active) return
      this.triggerEvent('scrub', { index })
    },
  },
})
