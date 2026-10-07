const store = Object.create(null)

function take(key) {
  return store[key] || null
}

function save(key, view) {
  store[key] = view
}

/** 有上次结果就先铺出来，请求在后台走。没有结果才出骨架。 */
function showCached(page, key, fields) {
  const cached = store[key]
  if (cached) {
    const patch = { loading: false, refreshing: true, error: '' }
    fields.forEach((field) => { patch[field] = cached[field] })
    page.setData(patch)
    return true
  }
  const patch = { loading: true, refreshing: true, error: '' }
  fields.forEach((field) => {
    if (field === 'sections' || field === 'events' || field === 'names') patch[field] = []
    if (field === 'total') patch[field] = 0
  })
  page.setData(patch)
  return false
}

function settle(page, key, view) {
  save(key, view)
  page.setData(Object.assign({ loading: false, refreshing: false, error: '' }, view))
}

function fail(page, error) {
  const message = (error && error.message) || '加载失败'
  const data = page.data || {}
  const keep = (data.sections && data.sections.length)
    || (data.events && data.events.length)
    || (data.games && data.games.length)
  page.setData({ loading: false, refreshing: false, error: keep ? '' : message })
  if (keep) wx.showToast({ title: message.slice(0, 18), icon: 'none' })
}

module.exports = { take, save, showCached, settle, fail }
