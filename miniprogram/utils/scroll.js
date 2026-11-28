let top = 0

function set(value) {
  top = Number(value) || 0
}

function get() {
  return top
}

function pointIn(touch, rect) {
  if (!touch) return null
  if (rect && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
    const dy = get() - (rect.scrollTop || 0)
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top + dy,
    }
  }
  if (Number.isFinite(touch.x) && Number.isFinite(touch.y)) return { x: touch.x, y: touch.y }
  return null
}

module.exports = { set, get, pointIn }
