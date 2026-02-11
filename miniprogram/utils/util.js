/**
 * 工具函数集合
 */

// 格式化日期 YYYY-MM-DD
function formatDate(date) {
  if (typeof date === 'string') date = new Date(date)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 格式化日期时间 YYYY-MM-DD HH:mm
function formatDateTime(date) {
  if (typeof date === 'string') date = new Date(date)
  const dateStr = formatDate(date)
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${dateStr} ${h}:${min}`
}

// 格式化金额（保留两位小数）
function formatMoney(amount) {
  if (amount === null || amount === undefined) return '0.00'
  return Number(amount).toFixed(2)
}

// 获取当前月的天数
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

// 获取某天是星期几 (0-6, 0为周日)
function getDayOfWeek(year, month, day) {
  return new Date(year, month - 1, day).getDay()
}

// 生成日历数据
function generateCalendarData(year, month) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfWeek = getDayOfWeek(year, month, 1)
  const weeks = []
  let currentWeek = []

  // 填充上月的空白
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push({ day: 0, date: '' })
  }

  // 填充本月日期
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    currentWeek.push({ day, date: dateStr })
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  // 填充下月的空白
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ day: 0, date: '' })
    }
    weeks.push(currentWeek)
  }

  return weeks
}

// 获取相对时间描述
function relativeTime(date) {
  if (typeof date === 'string') date = new Date(date)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 30) return `${days}天前`
  return formatDate(date)
}

// 状态文字映射
function getStatusText(status) {
  const map = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝'
  }
  return map[status] || status
}

// 角色文字映射
function getRoleText(role) {
  const map = {
    parent: '家长',
    child: '小孩'
  }
  return map[role] || role
}

module.exports = {
  formatDate,
  formatDateTime,
  formatMoney,
  getDaysInMonth,
  getDayOfWeek,
  generateCalendarData,
  relativeTime,
  getStatusText,
  getRoleText
}
