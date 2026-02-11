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

module.exports = {
  callCloud,
  showLoading,
  hideLoading,
  showToast,
  showError
}
