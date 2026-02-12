/**
 * 云函数调用封装
 * 统一调用 babySaver 云函数
 */

function callCloud(type, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'babySaver',
      data: { type, data }
    }).then(res => {
      const result = res.result
      if (result.code === 0) {
        resolve(result)
      } else if (result.code === 1) {
        // 业务状态码1表示数据为空等非错误情况
        resolve(result)
      } else {
        reject(result)
      }
    }).catch(err => {
      console.error(`[API] ${type} 调用失败:`, err)
      reject({ code: -1, msg: '网络异常，请稍后重试' })
    })
  })
}

// 显示加载中
function showLoading(title = '加载中...') {
  wx.showLoading({ title, mask: true })
}

// 隐藏加载
function hideLoading() {
  wx.hideLoading()
}

// 显示提示
function showToast(title, icon = 'none') {
  wx.showToast({ title, icon, duration: 2000 })
}

// 显示错误提示
function showError(msg) {
  wx.showToast({ title: msg || '操作失败', icon: 'none', duration: 2500 })
}

/**
 * 将 cloud:// fileID 转换为临时可访问的 HTTPS URL
 * cloud:// 在某些基础库版本 / 真机环境下 image 组件无法直接渲染，
 * 通过 getTempFileURL 拿到临时 HTTPS 链接可确保跨设备显示。
 * @param {string[]} fileIDs - cloud:// 开头的文件 ID 数组
 * @returns {Object} fileID → tempUrl 映射
 */
async function resolveCloudFileUrls(fileIDs) {
  if (!fileIDs || fileIDs.length === 0) return {}
  try {
    const res = await wx.cloud.getTempFileURL({ fileList: fileIDs })
    const map = {}
    if (res.fileList) {
      res.fileList.forEach(item => {
        if (item.status === 0 && item.tempFileURL) {
          map[item.fileID] = item.tempFileURL
        }
      })
    }
    return map
  } catch (err) {
    console.error('getTempFileURL 失败:', err)
    return {}
  }
}

/**
 * 批量解析对象数组中的 avatarUrl（cloud:// → https://）
 * @param {Array} list - 包含 avatarUrl 字段的对象数组
 * @param {string} field - 头像字段名，默认 'avatarUrl'
 * @returns {Array} 替换后的数组
 */
async function resolveAvatars(list, field = 'avatarUrl') {
  if (!list || list.length === 0) return list
  // 收集需要转换的 cloud:// fileID
  const cloudIds = list
    .map(item => item[field])
    .filter(url => url && url.startsWith('cloud://'))
  if (cloudIds.length === 0) return list
  // 去重
  const uniqueIds = [...new Set(cloudIds)]
  const urlMap = await resolveCloudFileUrls(uniqueIds)
  // 替换：转换成功用 HTTPS URL，转换失败清空（让 emoji 降级生效）
  return list.map(item => {
    const url = item[field]
    if (url && url.startsWith('cloud://')) {
      return { ...item, [field]: urlMap[url] || '' }
    }
    return item
  })
}

/**
 * 解析单个用户的 avatarUrl
 * @param {Object} userInfo - 用户对象
 * @returns {Object} 替换后的用户对象
 */
async function resolveUserAvatar(userInfo) {
  if (!userInfo || !userInfo.avatarUrl) return userInfo
  if (!userInfo.avatarUrl.startsWith('cloud://')) return userInfo
  const urlMap = await resolveCloudFileUrls([userInfo.avatarUrl])
  // 转换成功用 HTTPS URL，失败清空（让 emoji 降级生效，避免 cloud:// 渲染报错）
  return { ...userInfo, avatarUrl: urlMap[userInfo.avatarUrl] || '' }
}

module.exports = {
  callCloud,
  showLoading,
  hideLoading,
  showToast,
  showError,
  resolveCloudFileUrls,
  resolveAvatars,
  resolveUserAvatar
}
