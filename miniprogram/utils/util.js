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
    rejected: '已拒绝',
    success: '成功'
  }
  return map[status] || status
}

// 账单类型映射
function getTransactionTypeText(type) {
  const map = {
    deposit: '存入',
    withdraw: '取现',
    buy: '买入理财',
    redeem: '赎回理财',
    interest: '利息'
  }
  return map[type] || type
}

// 账单类型图标
function getTransactionTypeIcon(type) {
  const map = {
    deposit: '💰',
    withdraw: '💳',
    buy: '📈',
    redeem: '🔄',
    interest: '✨'
  }
  return map[type] || '📄'
}

// 风险等级映射
function getRiskLabel(riskLevel) {
  const map = { low: '低风险', medium: '中风险', high: '高风险' }
  return map[riskLevel] || riskLevel
}

// 风险等级颜色
function getRiskColor(riskLevel) {
  const map = { low: '#07c160', medium: '#ff9800', high: '#ff4d4f' }
  return map[riskLevel] || '#999'
}

// 角色文字映射
function getRoleText(role) {
  const map = {
    parent: '家长',
    child: '小孩'
  }
  return map[role] || role
}

// 家长身份标识映射（获取显示文字）
function getParentTitleText(parentTitle) {
  const titles = ['爸爸', '妈妈', '爷爷', '奶奶', '外公', '外婆', '其他']
  if (titles.includes(parentTitle)) return parentTitle
  return '家长'
}

// 获取家长身份对应的表情图标
function getParentTitleEmoji(parentTitle) {
  const map = {
    '爸爸': '👨',
    '妈妈': '👩',
    '爷爷': '👴',
    '奶奶': '👵',
    '外公': '👴',
    '外婆': '👵',
    '其他': '👤'
  }
  return map[parentTitle] || '👨‍👩‍👧'
}

// 获取成员显示的角色文字（含家长身份标识）
function getMemberRoleText(member) {
  if (member.role === 'child') return '小孩'
  if (member.role === 'parent') {
    const title = member.parentTitle ? getParentTitleText(member.parentTitle) : '家长'
    if (member.isCreator) return title + '（创建者）'
    return title
  }
  return getRoleText(member.role)
}

// 获取成员显示的表情图标
function getMemberEmoji(member) {
  if (member.role === 'child') return '🧒'
  if (member.role === 'parent') {
    return getParentTitleEmoji(member.parentTitle)
  }
  return '👤'
}

// 家长身份可选列表
function getParentTitleOptions() {
  return ['爸爸', '妈妈', '爷爷', '奶奶', '外公', '外婆', '其他']
}

// ========== 交易标签映射 ==========

// 存入来源标签
const DEPOSIT_TAG_MAP = {
  pocket_money: { icon: '💰', label: '零花钱' },
  new_year:     { icon: '🧧', label: '压岁钱' },
  birthday:     { icon: '🎂', label: '生日红包' },
  reward:       { icon: '🏆', label: '奖励' },
  study:        { icon: '📚', label: '学习奖金' },
  chores:       { icon: '🧹', label: '家务劳动' },
  gift:         { icon: '🎁', label: '礼物红包' },
  savings:      { icon: '🐷', label: '主动存入' },
  other:        { icon: '📝', label: '其他' }
}

// 取现用途标签
const WITHDRAW_TAG_MAP = {
  snack:      { icon: '🍭', label: '零食' },
  toy:        { icon: '🧸', label: '玩具' },
  book:       { icon: '📖', label: '书籍' },
  stationery: { icon: '✏️', label: '文具' },
  clothing:   { icon: '👕', label: '衣服' },
  travel:     { icon: '🎡', label: '游玩' },
  movie:      { icon: '🎬', label: '电影' },
  sports:     { icon: '⚽', label: '运动' },
  gift_buy:   { icon: '🎁', label: '买礼物' },
  other:      { icon: '📝', label: '其他' }
}

// 根据交易类型和 tag key 获取标签信息
function getTagInfo(type, tagKey) {
  if (!tagKey) return null
  const map = type === 'deposit' ? DEPOSIT_TAG_MAP : WITHDRAW_TAG_MAP
  return map[tagKey] || null
}

// 获取标签显示文字（icon + label）
function getTagText(type, tagKey) {
  const info = getTagInfo(type, tagKey)
  return info ? `${info.icon} ${info.label}` : ''
}

// 获取标签 label
function getTagLabel(type, tagKey) {
  const info = getTagInfo(type, tagKey)
  return info ? info.label : ''
}

// 获取标签 icon
function getTagIcon(type, tagKey) {
  const info = getTagInfo(type, tagKey)
  return info ? info.icon : ''
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
  getTransactionTypeText,
  getTransactionTypeIcon,
  getRiskLabel,
  getRiskColor,
  getRoleText,
  getParentTitleText,
  getParentTitleEmoji,
  getMemberRoleText,
  getMemberEmoji,
  getParentTitleOptions,
  getTagInfo,
  getTagText,
  getTagLabel,
  getTagIcon,
  DEPOSIT_TAG_MAP,
  WITHDRAW_TAG_MAP
}
