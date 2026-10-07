const { drawTrend, nearest } = require('../../utils/curve')

function tipNumber(axis, value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-'
  const n = Number(value)
  if (axis === 'rate') return `${(n * 100).toFixed(1)}%`
  if (axis === 'pct') return `${n.toFixed(1)}%`
  if (axis === 'yuan') return n.toFixed(2)
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`
  return String(Math.round(n))
}

Component({
  properties: {
    labels: { type: Array, value: [] },
    series: { type: Array, value: [] },
    axis: { type: String, value: 'count' },
  },

  data: { tip: '' },

  lifetimes: {
    ready() {
      this._ready = true
      this.draw()
    },
  },

  observers: {
    'labels, series, axis': function observe() {
      if (this._ready) this.draw()
    },
  },

  methods: {
    draw(retry) {
      const series = this.data.series || []
      const labels = this.data.labels || []
      if (!series.length) return
      const query = this.createSelectorQuery()
      query.select('#trend').fields({ node: true, size: true }).exec((res) => {
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
        const [first, ...rest] = series
        this._cssWidth = info.width
        this._plot = drawTrend(ctx, info.width, info.height, {
          primary: first.values || [],
          overlays: rest.map((item) => ({ values: item.values || [], color: item.color, width: 1.6 })),
          labels,
          active: this._active,
          color: first.color || '#1F4B99',
          axis: this.data.axis || 'count',
        })
      })
    },

    onScrub(event) {
      const touch = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0])
      if (!touch || !this._plot || typeof touch.x !== 'number') return
      const index = nearest(this._plot.xs, touch.x)
      if (index === this._active) return
      this._active = index
      const axis = this.data.axis || 'count'
      const label = (this.data.labels || [])[index] || ''
      const parts = (this.data.series || []).map((item) => `${item.name} ${tipNumber(axis, (item.values || [])[index])}`)
      this.setData({ tip: [label].concat(parts).join('  ') })
      this.draw(true)
    },
  },
})
