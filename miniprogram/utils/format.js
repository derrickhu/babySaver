function finite(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatNum(value) {
  const n = finite(value)
  if (n === null) return '-'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 10000) {
    const w = abs / 10000
    return `${sign}${w >= 10 ? w.toFixed(0) : w.toFixed(1)}万`
  }
  return sign + Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatYuan(value) {
  const n = finite(value)
  if (n === null) return '-'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 10000) {
    const w = abs / 10000
    return `${sign}${w >= 10 ? w.toFixed(1) : w.toFixed(2)}万`
  }
  return sign + abs.toFixed(2)
}

function formatRate(value) {
  const n = finite(value)
  if (n === null) return '-'
  return `${(n * 100).toFixed(1)}%`
}

/** 后端已经乘过 100 的比例，例如填充率 8.5 表示 8.5%。 */
function formatPctPoints(value) {
  const n = finite(value)
  if (n === null) return '-'
  return `${n.toFixed(1)}%`
}

function formatDuration(ms) {
  const n = finite(ms)
  if (n === null || n <= 0) return '-'
  const sec = Math.round(n / 1000)
  if (sec < 60) return `${sec}秒`
  const min = Math.floor(sec / 60)
  const rest = sec % 60
  return rest ? `${min}分${rest}秒` : `${min}分`
}

function formatMinutes(value) {
  const n = finite(value)
  if (n === null) return '-'
  return `${n.toFixed(1)}分`
}

function formatTime(ts) {
  const n = finite(ts)
  if (n === null || n < 1e11) return '-'
  const d = new Date(n)
  const p = (v) => (v < 10 ? `0${v}` : `${v}`)
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function delta(current, previous, reverse) {
  const a = finite(current)
  const b = finite(previous)
  if (a === null || b === null) return { text: '', color: '' }
  if (b === 0) return { text: a === 0 ? '较昨日 0%' : '昨日为 0', color: '' }
  const diff = ((a - b) / Math.abs(b)) * 100
  const sign = diff > 0 ? '+' : ''
  const good = reverse ? diff < 0 : diff > 0
  return {
    text: `较昨日 ${sign}${diff.toFixed(1)}%`,
    color: diff === 0 ? '' : good ? '#15803D' : '#B91C1C',
  }
}

module.exports = {
  finite,
  formatNum,
  formatYuan,
  formatRate,
  formatPctPoints,
  formatDuration,
  formatMinutes,
  formatTime,
  delta,
}
