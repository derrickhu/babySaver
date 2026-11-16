const { niceMax } = require('../../utils/curve')
const { formatNum } = require('../../utils/format')

const HEIGHT = 220
const PAD_T = 22
const PAD_B = 34

function nums(values) {
  return (values || []).map((value) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  })
}

Component({
  properties: {
    labels: { type: Array, value: [] },
    values: { type: Array, value: [] },
    unit: { type: String, value: '' },
    valueUnit: { type: String, value: '' },
  },

  data: {
    chips: [],
    scrollable: false,
    readout: '',
    active: 0,
  },

  lifetimes: {
    ready() {
      this._ready = true
      this._offset = 0
      this.layout()
    },
  },

  observers: {
    'labels, values, unit, valueUnit': function observe() {
      if (this._ready) this.layout()
    },
  },

  methods: {
    layout() {
      const labels = this.data.labels || []
      const values = nums(this.data.values)
      const n = labels.length
      if (!n) return
      const signature = labels.join('\n')
      if (signature !== this._signature) {
        this._signature = signature
        this._active = null
        this._offset = 0
      }
      const longest = labels.reduce((max, item) => Math.max(max, String(item).length), 1)
      this._slot = Math.max(36, Math.min(72, longest * 7 + 16))
      const query = this.createSelectorQuery()
      query.select('.plot-box').boundingClientRect()
      query.exec((res) => {
        const view = res && res[0] && res[0].width
        if (!view) {
          if (!this._layoutRetry) {
            this._layoutRetry = true
            setTimeout(() => this.layout(), 60)
          }
          return
        }
        this._layoutRetry = false
        this._viewW = view
        if (this._active == null || this._active < 0 || this._active >= n) {
          let best = 0
          values.forEach((value, index) => {
            if (value > values[best]) best = index
          })
          this._active = best
        }
        const contentW = n * this._slot
        this._offset = this.clampOffset(this._offset || 0, contentW, view)
        this.setData({
          chips: this.makeChips(labels, values),
          scrollable: contentW > view + 8,
          active: this._active,
          readout: this.readout(this._active),
        }, () => this.draw())
      })
    },

    clampOffset(offset, contentW, view) {
      const max = Math.max(0, contentW - view)
      return Math.max(0, Math.min(max, offset))
    },

    makeChips(labels, values) {
      const unit = this.data.unit
      const valueUnit = this.data.valueUnit || ''
      const chips = []
      labels.forEach((item, index) => {
        const text = String(item)
        if (!text.includes('-') && !text.endsWith('+')) return
        chips.push({
          index,
          label: unit ? `${text} ${unit}` : text,
          text: `${formatNum(values[index])}${valueUnit}`,
        })
      })
      return chips
    },

    readout(index) {
      const label = String((this.data.labels || [])[index] || '')
      const value = formatNum((this.data.values || [])[index])
      const unit = this.data.unit ? ` ${this.data.unit}` : ''
      const valueUnit = this.data.valueUnit || ''
      return `${label}${unit} · ${value}${valueUnit}`
    },

    select(index) {
      const n = (this.data.labels || []).length
      if (index < 0 || index >= n || index === this._active) return
      this._active = index
      try { wx.vibrateShort({ type: 'light' }) } catch (error) { /* 模拟器可能没有振动 */ }
      this.setData({ active: index, readout: this.readout(index) })
      this.redrawPlot()
    },

    onChip(event) {
      const index = Number(event.currentTarget.dataset.index)
      const n = (this.data.labels || []).length
      if (index < 0 || index >= n) return
      const slot = this._slot || 40
      const view = this._viewW || 280
      this._offset = this.clampOffset(index * slot - (view - slot) / 2, n * slot, view)
      if (index !== this._active) this.select(index)
      else this.redrawPlot()
    },

    onTouchStart(event) {
      const touch = event.touches && event.touches[0]
      if (!touch) return
      const point = this.touchPoint(touch)
      this._sx = point.x
      this._sy = point.y
      this._so = this._offset || 0
      this._dragged = false
    },

    onTouchMove(event) {
      const touch = event.touches && event.touches[0]
      if (!touch || this._sx == null) return
      const point = this.touchPoint(touch)
      const dx = point.x - this._sx
      const dy = point.y - this._sy
      if (!this._dragged && Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      if (!this._dragged && Math.abs(dy) > Math.abs(dx)) return
      this._dragged = true
      const n = (this.data.labels || []).length
      const view = this._viewW || 280
      this._offset = this.clampOffset(this._so - dx, n * (this._slot || 40), view)
      this.redrawPlot()
    },

    onTouchEnd(event) {
      if (this._dragged) {
        this._dragged = false
        return
      }
      const touch = (event.changedTouches && event.changedTouches[0]) || {}
      const point = this.touchPoint(touch)
      const local = point.x + (this._offset || 0)
      this.select(Math.floor(local / (this._slot || 40)))
    },

    touchPoint(touch) {
      return {
        x: typeof touch.x === 'number' ? touch.x : Number(touch.clientX) || 0,
        y: typeof touch.y === 'number' ? touch.y : Number(touch.clientY) || 0,
      }
    },

    draw() {
      this.paint('axis', (ctx, width, height) => this.drawAxis(ctx, width, height))
      this.paint('plot', (ctx, width, height) => {
        this._plotCtx = ctx
        this._plotW = width
        this._plotH = height
        this._viewW = width
        this.drawPlot(ctx, width, height)
      })
    },

    redrawPlot() {
      if (!this._plotCtx) {
        this.draw()
        return
      }
      this.drawPlot(this._plotCtx, this._plotW, this._plotH)
    },

    paint(id, render, retry) {
      const query = this.createSelectorQuery()
      query.select(`#${id}`).fields({ node: true, size: true }).exec((res) => {
        const info = res && res[0]
        if (!info || !info.node || !info.width || !info.height) {
          if (!retry) setTimeout(() => this.paint(id, render, true), 60)
          return
        }
        const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2
        const canvas = info.node
        const ctx = canvas.getContext('2d')
        canvas.width = Math.round(info.width * dpr)
        canvas.height = Math.round(info.height * dpr)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        render(ctx, info.width, info.height)
      })
    },

    yMax() {
      return niceMax(Math.max(...nums(this.data.values), 0))
    },

    yAt(value, yMax) {
      const plotH = HEIGHT - PAD_T - PAD_B
      return PAD_T + plotH - (Math.max(0, value) / yMax) * plotH
    },

    drawAxis(ctx, width, height) {
      const yMax = this.yMax()
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#8C8276'
      ctx.font = '11px PingFang SC, sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      for (let tick = 0; tick <= 3; tick += 1) {
        const value = (yMax * tick) / 3
        ctx.fillText(formatNum(value), width - 4, this.yAt(value, yMax))
      }
    },

    drawPlot(ctx, width, height) {
      const labels = this.data.labels || []
      const values = nums(this.data.values)
      const n = labels.length
      const slot = this._slot || 40
      const yMax = this.yMax()
      const offset = this.clampOffset(this._offset || 0, n * slot, width)
      this._offset = offset
      const bottom = HEIGHT - PAD_B
      ctx.clearRect(0, 0, width, height)
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, width, height)
      ctx.clip()
      ctx.translate(-offset, 0)
      ctx.strokeStyle = '#E7E1D6'
      ctx.lineWidth = 1
      for (let tick = 0; tick <= 3; tick += 1) {
        const y = this.yAt((yMax * tick) / 3, yMax)
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(n * slot, y)
        ctx.stroke()
      }
      labels.forEach((item, index) => {
        const value = values[index] || 0
        const selected = index === this._active
        const x = index * slot
        if (x + slot < offset - 2 || x > offset + width + 2) return
        const barW = Math.max(4, slot * 0.62)
        const top = value > 0 ? this.yAt(value, yMax) : bottom - 2
        const left = x + (slot - barW) / 2
        ctx.fillStyle = selected ? '#1F4B99' : '#B9CBEF'
        ctx.beginPath()
        const radius = Math.min(5, barW / 2, Math.max(2, bottom - top))
        ctx.moveTo(left, bottom)
        ctx.lineTo(left, top + radius)
        ctx.arcTo(left, top, left + radius, top, radius)
        ctx.lineTo(left + barW - radius, top)
        ctx.arcTo(left + barW, top, left + barW, top + radius, radius)
        ctx.lineTo(left + barW, bottom)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = selected ? '#1F4B99' : '#8C8276'
        ctx.font = `${selected ? '600 ' : ''}10px PingFang SC, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(String(item), x + slot / 2, bottom + 8)
        if (selected) {
          ctx.fillStyle = '#1F4B99'
          ctx.font = '11px PingFang SC, sans-serif'
          ctx.textBaseline = 'bottom'
          const textY = top > PAD_T + 12 ? top - 2 : top + 14
          ctx.fillText(formatNum(value), x + slot / 2, textY)
        }
      })
      ctx.restore()
    },
  },
})
