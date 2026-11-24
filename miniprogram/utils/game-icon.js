const config = require('./config')
const { headers } = require('./api')

const memory = {}
const jobs = {}

function safeName(gameKey) {
  return String(gameKey || '').replace(/[^A-Za-z0-9_-]/g, '_')
}

function dirPath() {
  return `${wx.env.USER_DATA_PATH}/game-icons`
}

function filePath(gameKey) {
  return `${dirPath()}/${safeName(gameKey)}.png`
}

function fs() {
  return wx.getFileSystemManager()
}

function ensureDir() {
  const dir = dirPath()
  try {
    fs().accessSync(dir)
  } catch (error) {
    fs().mkdirSync(dir)
  }
  return dir
}

function hasFile(path) {
  try {
    fs().accessSync(path)
    return true
  } catch (error) {
    return false
  }
}

function isImage(data) {
  if (!data || typeof data.byteLength !== 'number' || data.byteLength < 32) return false
  const bytes = new Uint8Array(data)
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  return png || jpeg
}

function displaySrc(gameKey) {
  if (!gameKey) return ''
  if (Object.prototype.hasOwnProperty.call(memory, gameKey)) return memory[gameKey]
  const saved = filePath(gameKey)
  memory[gameKey] = hasFile(saved) ? saved : `/images/games/${gameKey}.png`
  return memory[gameKey]
}

function savedSrc(gameKey) {
  const saved = filePath(gameKey)
  if (!hasFile(saved)) return ''
  memory[gameKey] = saved
  return saved
}

function markBroken(gameKey) {
  memory[gameKey] = ''
  return ''
}

function resetFailed() {
  Object.keys(jobs).forEach((key) => {
    if (!hasFile(filePath(key))) delete jobs[key]
  })
}

function fetchOnce(gameKey) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.publicBase}/game-icons/${encodeURIComponent(gameKey)}.png`,
      header: headers(),
      responseType: 'arraybuffer',
      timeout: 20000,
      success: (res) => {
        const status = res.statusCode || 0
        if (status === 200 && isImage(res.data)) {
          resolve(res.data)
          return
        }
        const error = new Error(status === 200 ? '图标不是图片' : `图标请求失败 ${status}`)
        error.statusCode = status
        error.retryable = status >= 500 || status === 0
        reject(error)
      },
      fail: (error) => {
        const wrapped = new Error((error && error.errMsg) || '图标下载失败')
        wrapped.retryable = true
        reject(wrapped)
      },
    })
  })
}

function writeIcon(gameKey, data) {
  ensureDir()
  const path = filePath(gameKey)
  return new Promise((resolve, reject) => {
    fs().writeFile({
      filePath: path,
      data,
      success: () => {
        memory[gameKey] = path
        resolve(path)
      },
      fail: reject,
    })
  })
}

function pull(gameKey, left) {
  return fetchOnce(gameKey).then((data) => writeIcon(gameKey, data)).catch((error) => {
    if (left > 0 && error && error.retryable) return pull(gameKey, left - 1)
    throw error
  })
}

function ensure(gameKeys) {
  const unique = []
  ;(gameKeys || []).forEach((key) => {
    if (key && unique.indexOf(key) < 0) unique.push(key)
  })
  unique.forEach((key) => {
    if (jobs[key]) return
    jobs[key] = pull(key, 1).catch(() => {
      delete jobs[key]
      return ''
    })
  })
  return Promise.all(unique.map((key) => jobs[key] || Promise.resolve('')))
}

module.exports = {
  displaySrc,
  savedSrc,
  markBroken,
  resetFailed,
  ensure,
}
