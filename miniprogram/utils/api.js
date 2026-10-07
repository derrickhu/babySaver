const config = require('./config')

function base64(input) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bytes = []
  const text = String(input)
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i)
    if (code < 128) bytes.push(code)
    else if (code < 2048) bytes.push(192 | (code >> 6), 128 | (code & 63))
    else {
      bytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63))
    }
  }
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    out += chars[b0 >> 2]
    out += chars[((b0 & 3) << 4) | (b1 >> 4)]
    out += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '='
    out += i + 2 < bytes.length ? chars[b2 & 63] : '='
  }
  return out
}

function toQuery(query) {
  if (!query) return ''
  return Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== null && query[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&')
}

function withQuery(path, query) {
  const qs = toQuery(query)
  return qs ? `${path}?${qs}` : path
}

function headers() {
  const header = {
    'content-type': 'application/json',
    'X-WX-SERVICE': config.service,
  }
  if (config.accessPassword) header.Authorization = `Basic ${base64(`ga:${config.accessPassword}`)}`
  return header
}

function unwrap(res) {
  const status = res.statusCode || 200
  let data = res.data
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch (error) {
      data = { ok: false, error: data.slice(0, 180) }
    }
  }
  if (status === 401) {
    const err = new Error('访问密码不正确')
    err.code = 401
    err.statusCode = 401
    throw err
  }
  if (status >= 400) {
    const err = new Error((data && (data.error || data.message)) || `请求失败 ${status}`)
    err.statusCode = status
    throw err
  }
  return data
}

function http(path, method, data, header) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.publicBase + path,
      method,
      header,
      data: method === 'GET' || method === 'DELETE' ? undefined : data,
      timeout: 60000,
      success: resolve,
      fail: reject,
    })
  })
}

function raise(error) {
  const message = (error && (error.message || error.errMsg)) || '网络请求失败'
  if (/url not in domain list|合法域名/i.test(message)) {
    throw new Error('请求域名未配置。请把 https://www.luckygua.cn 加入 request 合法域名。')
  }
  throw new Error(message)
}

function request(method, path, query, data) {
  const fullPath = withQuery(path, query)
  return http(fullPath, method, data, headers()).then(unwrap).catch(raise)
}

function get(path, query) {
  return request('GET', path, query)
}

function post(path, data, query) {
  return request('POST', path, query, data || {})
}

function del(path, query) {
  return request('DELETE', path, query)
}

module.exports = { get, post, del }
