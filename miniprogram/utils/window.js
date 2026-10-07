const OPTIONS = [
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: '60', label: '1小时' },
  { key: '360', label: '6小时' },
  { key: '1440', label: '24小时' },
  { key: '10080', label: '7天' },
  { key: '43200', label: '30天' },
]

function pad(n) {
  return n < 10 ? `0${n}` : `${n}`
}

function dateKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function tsToUtcBucket(ts) {
  const d = new Date(ts)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

function resolveWindow(windowKey, now = Date.now()) {
  if (windowKey === 'yesterday') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - 1)
    return { fromTs: start.getTime(), toTs: start.getTime() + 86400000 - 1 }
  }
  const minutes = Number(windowKey)
  if (Number.isFinite(minutes) && minutes > 0) {
    return { fromTs: now - minutes * 60000, toTs: now }
  }
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return { fromTs: start.getTime(), toTs: now }
}

function windowQuery(windowKey, shiftMs = 0) {
  const range = resolveWindow(windowKey)
  return {
    from: tsToUtcBucket(range.fromTs + shiftMs),
    to: tsToUtcBucket(range.toTs + shiftMs),
  }
}

function dateRangeQuery(windowKey, shiftMs = 0) {
  const range = resolveWindow(windowKey)
  return {
    from_date: dateKey(range.fromTs + shiftMs),
    to_date: dateKey(range.toTs + shiftMs),
  }
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return dateKey(d.getTime())
}

function recentDates(endOffset, days) {
  const end = addDays(dateKey(Date.now()), endOffset)
  return { from_date: addDays(end, -(days - 1)), to_date: end }
}

module.exports = {
  OPTIONS,
  dateKey,
  resolveWindow,
  windowQuery,
  dateRangeQuery,
  addDays,
  recentDates,
}
