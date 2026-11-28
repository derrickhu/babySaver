const { drawSpark, nearestOnCurve } = require('../../utils/curve')
const { formatYuan } = require('../../utils/format')
const scroll = require('../../utils/scroll')

Component({
  properties: {
    values: { type: Array, value: [] },
    labels: { type: Array, value: [] },
    color: { type: String, value: '#1F4B99' },
    active: { type: Number, value: -1 },
    longLabels: { type: Array, value: [] },
  },

  data: {
    tipShow: false,
    tipLeft: 0,
    tipTop: 0,
    tipDate: '',
    tipValue: '',
  },

  lifetimes: {
    ready() {
      this._ready = true
      this.draw()
    },
  },

  observers: {
    'values, labels, longLabels, color, active': function observe() {
      if (!this._ready) return
      const values = this.data.values || []
      const labels = this.data.longLabels || []
      const mark = `${this.data.active}|${this.data.color}|${labels[this.data.active] || ''}|${values.join(',')}`
      if (mark === this._drawMark) return
      this._drawMark = mark
      this.draw()
    },
  },

  methods: {
    placeTip() {
      const active = this.data.active
      const plot = this._plot
      if (active == null || active < 0 || !plot || plot.xs[active] == null) {
        if (this.data.tipShow) this.setData({ tipShow: false })
        return
      }
      const x = plot.xs[active]
      const width = this._cssWidth || 300
      const tipW = 132
      let left = x - tipW / 2
      left = Math.max(4, Math.min(left, width - tipW - 4))
      const top = (this._cssHeight || 44) + 6
      const longLabels = this.data.longLabels || []
      const labels = longLabels.length ? longLabels : (this.data.labels || [])
      this.setData({
        tipShow: true,
        tipLeft: left,
        tipTop: top,
        tipDate: labels[active] || '',
        tipValue: formatYuan((this.data.values || [])[active] || 0),
      })
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
        const width = Math.round(info.width * dpr)
        const height = Math.round(info.height * dpr)
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        this._cssWidth = info.width
        this._cssHeight = info.height
        this._plot = drawSpark(ctx, info.width, info.height, values, color, this.data.active)
        this.placeTip()
        this.createSelectorQuery().select('#spark').boundingClientRect((rect) => {
          if (!rect || !rect.width) return
          rect.scrollTop = scroll.get()
          this._rect = rect
        }).exec()
      })
    },

    onTouch(event) {
      const touch = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0])
      if (!touch || !this._plot || !this._plot.xs.length) return
      const point = scroll.pointIn(touch, this._rect)
      if (!point) return
      if (event.type === 'touchstart') {
        this._originX = point.x
        this._originY = point.y
        this._scrollGesture = false
        return
      }
      const dx = Math.abs(point.x - this._originX)
      const dy = Math.abs(point.y - this._originY)
      if (event.type === 'touchmove') {
        if (dy > 10 && dy > dx) this._scrollGesture = true
        if (this._scrollGesture || dx < 8) return
        this.emitPoint(point)
        return
      }
      if (event.type === 'touchcancel' || this._scrollGesture) {
        this._scrollGesture = false
        return
      }
      this.emitPoint(point)
    },

    emitPoint(point) {
      const index = nearestOnCurve(this._plot.xs, this._plot.ys, point.x, point.y, 36)
      if (index < 0 || index === this.data.active) return
      this.triggerEvent('scrub', { index })
    },
  },
})
