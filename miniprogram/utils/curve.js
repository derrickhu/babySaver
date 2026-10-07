function niceMax(max) {
  if (!(max > 0)) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(max)))
  const fraction = max / exp
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * exp
}

function finite(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function shortAxis(value, axis) {
  if (!value) return '0'
  if (axis === 'rate') return `${Math.round(value * 100)}%`
  if (axis === 'pct') return `${Math.round(value)}%`
  if (axis === 'count') {
    if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`
    return String(Math.round(value))
  }
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`
  if (value >= 100) return String(Math.round(value))
  return value.toFixed(value >= 10 ? 0 : 1)
}

function segmentsOf(values, xAt, yAt) {
  const parts = []
  let current = []
  values.forEach((value, index) => {
    const n = finite(value)
    if (n === null) {
      if (current.length) parts.push(current)
      current = []
      return
    }
    current.push({ x: xAt(index), y: yAt(n), index })
  })
  if (current.length) parts.push(current)
  return parts
}

function hexAlpha(hex, alpha) {
  const raw = String(hex || '#1F4B99').replace('#', '')
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function traceSmooth(ctx, pts) {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const low = Math.min(p1.y, p2.y)
    const high = Math.max(p1.y, p2.y)
    const cp1y = Math.min(high, Math.max(low, p1.y + (p2.y - p0.y) / 6))
    const cp2y = Math.min(high, Math.max(low, p2.y - (p3.y - p1.y) / 6))
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
  }
}

function labelIndexes(count) {
  if (count <= 1) return [0]
  const want = count > 16 ? 5 : count > 8 ? 4 : Math.min(count, 4)
  const indexes = []
  for (let i = 0; i < want; i += 1) indexes.push(Math.round((i * (count - 1)) / (want - 1)))
  return Array.from(new Set(indexes))
}

function dot(ctx, x, y, color, radius) {
  ctx.beginPath()
  ctx.fillStyle = '#FFFDF8'
  ctx.arc(x, y, radius + 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.fillStyle = color
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

function drawTrend(ctx, width, height, spec) {
  const primary = spec.primary || []
  const overlays = spec.overlays || []
  const labels = spec.labels || []
  const active = spec.active
  const color = spec.color || '#1F4B99'
  const axis = spec.axis || 'yuan'
  const count = Math.max(labels.length, primary.length, 1)
  ctx.clearRect(0, 0, width, height)
  const pad = { l: 40, r: 14, t: 18, b: 30 }
  const plotW = Math.max(1, width - pad.l - pad.r)
  const plotH = Math.max(1, height - pad.t - pad.b)
  let max = 0
  const consider = (value) => {
    const n = finite(value)
    if (n !== null && n > max) max = n
  }
  primary.forEach(consider)
  overlays.forEach((layer) => { (layer.values || []).forEach(consider) })
  const yMax = niceMax(max)
  const xs = []
  const ys = []
  const xAt = (index) => (count <= 1 ? pad.l + plotW / 2 : pad.l + (index / (count - 1)) * plotW)
  const yAt = (value) => pad.t + plotH - (Math.max(0, value) / yMax) * plotH
  for (let i = 0; i < count; i += 1) {
    xs.push(xAt(i))
    const n = finite(primary[i])
    ys.push(n === null ? null : yAt(n))
  }

  ctx.save()
  ctx.strokeStyle = '#E7E1D6'
  ctx.lineWidth = 1
  ctx.fillStyle = '#8C8276'
  ctx.font = '11px PingFang SC, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let tick = 0; tick <= 3; tick += 1) {
    const value = (yMax * tick) / 3
    const y = yAt(value)
    ctx.beginPath()
    ctx.moveTo(pad.l, y)
    ctx.lineTo(width - pad.r, y)
    ctx.stroke()
    ctx.fillText(shortAxis(value, axis), pad.l - 6, y)
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  labelIndexes(count).forEach((index) => {
    if (xs[index] == null) return
    ctx.fillText(labels[index] || '', xs[index], pad.t + plotH + 8)
  })
  ctx.restore()

  const primaryParts = segmentsOf(primary, xAt, yAt)
  primaryParts.forEach((pts) => {
    if (pts.length < 2) return
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH)
    grad.addColorStop(0, hexAlpha(color, 0.3))
    grad.addColorStop(1, hexAlpha(color, 0))
    traceSmooth(ctx, pts)
    ctx.lineTo(pts[pts.length - 1].x, pad.t + plotH)
    ctx.lineTo(pts[0].x, pad.t + plotH)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()
  })

  overlays.forEach((layer) => {
    segmentsOf(layer.values || [], xAt, yAt).forEach((pts) => {
      if (pts.length < 2) return
      ctx.save()
      ctx.strokeStyle = layer.color
      ctx.globalAlpha = 0.95
      ctx.lineWidth = layer.width || 1.5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      traceSmooth(ctx, pts)
      ctx.stroke()
      ctx.restore()
    })
  })

  primaryParts.forEach((pts) => {
    if (pts.length < 2) return
    ctx.strokeStyle = color
    ctx.lineWidth = 2.6
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    traceSmooth(ctx, pts)
    ctx.stroke()
  })

  const lastPart = primaryParts[primaryParts.length - 1]
  const last = lastPart && lastPart[lastPart.length - 1]
  if (last && (active == null || active === last.index)) dot(ctx, last.x, last.y, color, 3.5)
  if (active != null && ys[active] != null) {
    ctx.save()
    ctx.strokeStyle = hexAlpha(color, 0.45)
    ctx.lineWidth = 1
    if (ctx.setLineDash) ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(xs[active], pad.t)
    ctx.lineTo(xs[active], pad.t + plotH)
    ctx.stroke()
    ctx.restore()
    dot(ctx, xs[active], ys[active], color, 5.5)
  }

  return { xs, ys, top: pad.t, bottom: pad.t + plotH }
}

function drawSpark(ctx, width, height, values, color, active) {
  ctx.clearRect(0, 0, width, height)
  const series = values || []
  if (!series.length || width < 4 || height < 4) return { xs: [], ys: [] }
  const pad = 4
  let max = 0
  series.forEach((value) => { if (value > max) max = value })
  if (!(max > 0)) max = 1
  const yAt = (value) => height - pad - (Math.max(0, value) / max) * (height - pad * 2)
  const xAt = (index) => (
    series.length <= 1 ? width / 2 : pad + (index / (series.length - 1)) * (width - pad * 2)
  )
  const pts = series.map((value, index) => ({ x: xAt(index), y: yAt(value || 0) }))
  if (pts.length >= 2) {
    const grad = ctx.createLinearGradient(0, pad, 0, height)
    grad.addColorStop(0, hexAlpha(color, 0.22))
    grad.addColorStop(1, hexAlpha(color, 0))
    traceSmooth(ctx, pts)
    ctx.lineTo(pts[pts.length - 1].x, height - 1)
    ctx.lineTo(pts[0].x, height - 1)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.6
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    traceSmooth(ctx, pts)
    ctx.stroke()
  }
  const picked = active != null && active >= 0 ? pts[active] : pts[pts.length - 1]
  if (picked && active != null && active >= 0) {
    ctx.save()
    ctx.strokeStyle = hexAlpha(color, 0.45)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(picked.x, pad)
    ctx.lineTo(picked.x, height - pad)
    ctx.stroke()
    ctx.restore()
  }
  if (picked) dot(ctx, picked.x, picked.y, color, active != null && active >= 0 ? 3.2 : 2.2)
  return { xs: pts.map((point) => point.x), ys: pts.map((point) => point.y) }
}

function nearest(xs, x) {
  let best = 0
  let dist = Infinity
  for (let i = 0; i < xs.length; i += 1) {
    const gap = Math.abs(xs[i] - x)
    if (gap < dist) {
      dist = gap
      best = i
    }
  }
  return best
}

module.exports = {
  niceMax,
  drawTrend,
  drawSpark,
  nearest,
}
