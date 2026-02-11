// 小孩存钱宝 - 云函数入口
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 路由分发
exports.main = async (event, context) => {
  const { type, data = {} } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    switch (type) {
      // 初始化
      case 'initCollections': return await initCollections()
      // 用户相关
      case 'register': return await register(openid, data)
      case 'getUserInfo': return await getUserInfo(openid)
      case 'updateParentTitle': return await updateParentTitle(openid, data)
      // 家庭相关
      case 'createFamily': return await createFamily(openid, data)
      case 'joinFamily': return await joinFamily(openid, data)
      case 'getFamily': return await getFamily(openid)
      case 'getFamilyMembers': return await getFamilyMembers(openid)
      // 存款相关
      case 'setDeposit': return await setDeposit(openid, data)
      case 'getDeposit': return await getDeposit(openid, data)
      case 'getChildDeposits': return await getChildDeposits(openid)
      // 收益相关
      case 'calcEarnings': return await calcEarnings(openid, data)
      case 'getEarnings': return await getEarnings(openid, data)
      case 'getEarningsCalendar': return await getEarningsCalendar(openid, data)
      case 'getEarningsTrend': return await getEarningsTrend(openid, data)
      // 取现相关
      case 'applyWithdraw': return await applyWithdraw(openid, data)
      case 'reviewWithdraw': return await reviewWithdraw(openid, data)
      case 'getWithdrawals': return await getWithdrawals(openid, data)
      case 'getPendingCount': return await getPendingCount(openid)
      default:
        return { code: -1, msg: '未知操作类型' }
    }
  } catch (err) {
    console.error(`[babySaver] type=${type} error:`, err)
    return { code: -1, msg: err.message || '服务器错误' }
  }
}

// ========== 初始化集合 ==========

// 自动创建所有需要的数据库集合
async function initCollections() {
  const collections = ['users', 'families', 'deposits', 'earnings', 'withdrawals']
  const results = []

  for (const name of collections) {
    try {
      await db.createCollection(name)
      results.push({ name, status: 'created' })
    } catch (err) {
      // -502014 表示集合已存在，忽略
      if (err.errCode === -502014) {
        results.push({ name, status: 'exists' })
      } else {
        results.push({ name, status: 'error', msg: err.message })
      }
    }
  }

  return { code: 0, msg: '集合初始化完成', data: results }
}

// ========== 用户相关 ==========

// 家长身份可选值
const PARENT_TITLES = ['爸爸', '妈妈', '爷爷', '奶奶', '外公', '外婆', '其他']

// 注册用户
async function register(openid, data) {
  const { nickName, role, parentTitle, avatarUrl } = data
  if (!nickName || !role) {
    return { code: -1, msg: '昵称和角色不能为空' }
  }
  if (!['parent', 'child'].includes(role)) {
    return { code: -1, msg: '角色类型无效' }
  }

  // 家长必须选择身份标识
  if (role === 'parent') {
    if (!parentTitle || !PARENT_TITLES.includes(parentTitle)) {
      return { code: -1, msg: '请选择家长身份' }
    }
  }

  // 检查是否已注册
  const existing = await db.collection('users').where({ _openid: openid }).get()
  if (existing.data.length > 0) {
    return { code: -1, msg: '用户已注册' }
  }

  const now = new Date()
  const userData = {
    _openid: openid,
    nickName,
    role,
    familyId: '',
    avatarUrl: avatarUrl || '', // 支持从微信获取的头像
    createdAt: now,
    updatedAt: now
  }

  // 家长额外字段
  if (role === 'parent') {
    userData.parentTitle = parentTitle
  }

  await db.collection('users').add({ data: userData })
  return { code: 0, msg: '注册成功' }
}

// 获取用户信息
async function getUserInfo(openid) {
  const res = await db.collection('users').where({ _openid: openid }).get()
  if (res.data.length === 0) {
    return { code: 1, msg: '用户未注册', data: null }
  }
  return { code: 0, data: res.data[0] }
}

// 修改家长身份标识
async function updateParentTitle(openid, data) {
  const { parentTitle } = data
  if (!parentTitle || !PARENT_TITLES.includes(parentTitle)) {
    return { code: -1, msg: '请选择有效的家长身份' }
  }

  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0) {
    return { code: -1, msg: '用户不存在' }
  }
  if (user.data[0].role !== 'parent') {
    return { code: -1, msg: '仅家长可修改身份标识' }
  }

  const now = new Date()
  await db.collection('users').where({ _openid: openid }).update({
    data: { parentTitle, updatedAt: now }
  })

  return { code: 0, msg: '身份修改成功' }
}

// ========== 家庭相关 ==========

// 生成6位邀请码
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// 家长创建家庭
async function createFamily(openid, data) {
  // 验证是家长
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || user.data[0].role !== 'parent') {
    return { code: -1, msg: '仅家长可创建家庭' }
  }
  if (user.data[0].familyId) {
    return { code: -1, msg: '您已有家庭，无需重复创建' }
  }

  const familyName = data.familyName || `${user.data[0].nickName}的家庭`
  let inviteCode = generateInviteCode()

  // 确保邀请码唯一
  let exists = await db.collection('families').where({ inviteCode }).get()
  while (exists.data.length > 0) {
    inviteCode = generateInviteCode()
    exists = await db.collection('families').where({ inviteCode }).get()
  }

  const now = new Date()
  const familyRes = await db.collection('families').add({
    data: {
      familyName,
      inviteCode,
      creatorOpenId: openid,       // 创建者（只有创建者能分享邀请码）
      parentOpenIds: [openid],     // 所有家长列表
      childOpenIds: [],
      createdAt: now
    }
  })

  // 更新用户的 familyId
  await db.collection('users').where({ _openid: openid }).update({
    data: { familyId: familyRes._id, updatedAt: now }
  })

  return { code: 0, msg: '家庭创建成功', data: { familyId: familyRes._id, inviteCode } }
}

// 加入家庭（小孩或家长均可）
async function joinFamily(openid, data) {
  const { inviteCode } = data
  if (!inviteCode) {
    return { code: -1, msg: '请输入邀请码' }
  }

  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0) {
    return { code: -1, msg: '用户不存在' }
  }
  if (user.data[0].familyId) {
    return { code: -1, msg: '您已加入家庭' }
  }

  const family = await db.collection('families').where({ inviteCode: inviteCode.toUpperCase() }).get()
  if (family.data.length === 0) {
    return { code: -1, msg: '邀请码无效' }
  }

  const familyId = family.data[0]._id
  const userRole = user.data[0].role
  const now = new Date()

  // 根据角色加入不同列表
  if (userRole === 'child') {
    await db.collection('families').doc(familyId).update({
      data: { childOpenIds: _.push(openid) }
    })
  } else if (userRole === 'parent') {
    await db.collection('families').doc(familyId).update({
      data: { parentOpenIds: _.push(openid) }
    })
  }

  // 更新用户 familyId
  await db.collection('users').where({ _openid: openid }).update({
    data: { familyId, updatedAt: now }
  })

  return { code: 0, msg: '加入家庭成功' }
}

// 获取家庭信息
async function getFamily(openid) {
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0) {
    return { code: -1, msg: '用户不存在' }
  }
  if (!user.data[0].familyId) {
    return { code: 1, msg: '未加入家庭', data: null }
  }

  const family = await db.collection('families').doc(user.data[0].familyId).get()
  const familyData = family.data

  // 标记当前用户是否为创建者
  familyData.isCreator = (familyData.creatorOpenId === openid)

  // 兼容旧数据：如果没有 creatorOpenId，使用 parentOpenId
  if (!familyData.creatorOpenId && familyData.parentOpenId) {
    familyData.creatorOpenId = familyData.parentOpenId
    familyData.isCreator = (familyData.parentOpenId === openid)
  }
  // 兼容旧数据：如果没有 parentOpenIds，从 parentOpenId 生成
  if (!familyData.parentOpenIds && familyData.parentOpenId) {
    familyData.parentOpenIds = [familyData.parentOpenId]
  }

  return { code: 0, data: familyData }
}

// 获取家庭成员
async function getFamilyMembers(openid) {
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || !user.data[0].familyId) {
    return { code: -1, msg: '未加入家庭' }
  }

  const members = await db.collection('users').where({
    familyId: user.data[0].familyId
  }).get()

  // 获取家庭信息以标注创建者
  const family = await db.collection('families').doc(user.data[0].familyId).get()
  const creatorOpenId = family.data.creatorOpenId || family.data.parentOpenId

  const result = members.data.map(m => ({
    ...m,
    isCreator: m._openid === creatorOpenId
  }))

  return { code: 0, data: result }
}

// ========== 存款相关 ==========

// 家长设置存款（新增或更新）- 任一家长均可操作
async function setDeposit(openid, data) {
  const { childOpenId, principal, rate } = data
  if (!childOpenId || principal === undefined || rate === undefined) {
    return { code: -1, msg: '参数不完整' }
  }
  if (principal < 0 || rate < 0 || rate > 100) {
    return { code: -1, msg: '本金或利率设置不合法' }
  }

  // 验证是家长
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || user.data[0].role !== 'parent') {
    return { code: -1, msg: '仅家长可设置存款' }
  }

  // 验证小孩在同一家庭
  const child = await db.collection('users').where({ _openid: childOpenId }).get()
  if (child.data.length === 0 || child.data[0].familyId !== user.data[0].familyId) {
    return { code: -1, msg: '该小孩不在您的家庭中' }
  }

  const now = new Date()
  const today = formatDate(now)

  // 查找已有活跃存款
  const existing = await db.collection('deposits').where({
    childOpenId,
    familyId: user.data[0].familyId,
    status: 'active'
  }).get()

  if (existing.data.length > 0) {
    // 更新现有存款前先计算截止到今日的收益
    const deposit = existing.data[0]
    await doCalcEarnings(deposit)

    // 更新本金和利率
    const newBalance = deposit.balance + (principal - deposit.principal)
    await db.collection('deposits').doc(deposit._id).update({
      data: {
        principal: principal,
        rate: rate,
        balance: newBalance > 0 ? newBalance : 0,
        updatedAt: now
      }
    })
    return { code: 0, msg: '存款更新成功' }
  } else {
    // 新增存款
    await db.collection('deposits').add({
      data: {
        familyId: user.data[0].familyId,
        childOpenId,
        parentOpenId: openid,
        principal,
        rate,
        balance: principal,
        totalEarnings: 0,
        lastCalcDate: today,
        status: 'active',
        createdAt: now,
        updatedAt: now
      }
    })
    return { code: 0, msg: '存款设置成功' }
  }
}

// 获取存款信息
async function getDeposit(openid, data) {
  const childOpenId = data.childOpenId || openid
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || !user.data[0].familyId) {
    return { code: -1, msg: '未加入家庭' }
  }

  const deposit = await db.collection('deposits').where({
    childOpenId,
    familyId: user.data[0].familyId,
    status: 'active'
  }).get()

  if (deposit.data.length === 0) {
    return { code: 1, msg: '暂无存款记录', data: null }
  }

  return { code: 0, data: deposit.data[0] }
}

// 家长获取所有小孩的存款 - 任一家长均可查看
async function getChildDeposits(openid) {
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || user.data[0].role !== 'parent') {
    return { code: -1, msg: '权限不足' }
  }
  if (!user.data[0].familyId) {
    return { code: -1, msg: '未创建家庭' }
  }

  const deposits = await db.collection('deposits').where({
    familyId: user.data[0].familyId,
    status: 'active'
  }).get()

  // 获取小孩信息
  const childIds = [...new Set(deposits.data.map(d => d.childOpenId))]
  const children = await db.collection('users').where({
    _openid: _.in(childIds.length > 0 ? childIds : ['__none__'])
  }).get()

  const childMap = {}
  children.data.forEach(c => { childMap[c._openid] = c })

  const result = deposits.data.map(d => ({
    ...d,
    childName: childMap[d.childOpenId] ? childMap[d.childOpenId].nickName : '未知'
  }))

  return { code: 0, data: result }
}

// ========== 收益计算相关 ==========

// 日期格式化 YYYY-MM-DD
function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 获取两个日期之间的天数
function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1)
  const d2 = new Date(dateStr2)
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24))
}

// 核心：计算存款收益
async function doCalcEarnings(deposit) {
  const now = new Date()
  const today = formatDate(now)
  const lastDate = deposit.lastCalcDate

  if (lastDate >= today) {
    return // 今日已计算
  }

  const days = daysBetween(lastDate, today)
  if (days <= 0) return

  const dailyRate = deposit.rate / 100 / 365
  let currentBalance = deposit.balance
  let totalEarnings = deposit.totalEarnings
  const earningsRecords = []

  // 逐日计算收益
  for (let i = 1; i <= days; i++) {
    const calcDate = new Date(new Date(lastDate).getTime() + i * 86400000)
    const dateStr = formatDate(calcDate)
    const dailyEarning = Math.round(currentBalance * dailyRate * 100) / 100 // 保留2位小数

    totalEarnings = Math.round((totalEarnings + dailyEarning) * 100) / 100

    earningsRecords.push({
      depositId: deposit._id,
      childOpenId: deposit.childOpenId,
      familyId: deposit.familyId,
      date: dateStr,
      principal: deposit.principal,
      balance: currentBalance,
      rate: deposit.rate,
      dailyEarning,
      totalEarnings,
      createdAt: now
    })
  }

  // 批量写入收益记录（每次最多20条）
  for (let i = 0; i < earningsRecords.length; i += 20) {
    const batch = earningsRecords.slice(i, i + 20)
    const tasks = batch.map(record => db.collection('earnings').add({ data: record }))
    await Promise.all(tasks)
  }

  // 更新存款信息
  await db.collection('deposits').doc(deposit._id).update({
    data: {
      totalEarnings,
      lastCalcDate: today,
      updatedAt: now
    }
  })

  return { totalEarnings, days }
}

// 触发收益计算
async function calcEarnings(openid, data) {
  const childOpenId = data.childOpenId || openid
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || !user.data[0].familyId) {
    return { code: -1, msg: '未加入家庭' }
  }

  const deposits = await db.collection('deposits').where({
    childOpenId,
    familyId: user.data[0].familyId,
    status: 'active'
  }).get()

  if (deposits.data.length === 0) {
    return { code: 1, msg: '暂无存款记录' }
  }

  const deposit = deposits.data[0]
  const result = await doCalcEarnings(deposit)

  // 返回最新的存款信息
  const updated = await db.collection('deposits').doc(deposit._id).get()
  return { code: 0, data: updated.data, calcResult: result }
}

// 获取收益列表
async function getEarnings(openid, data) {
  const childOpenId = data.childOpenId || openid
  const { page = 1, pageSize = 20 } = data
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || !user.data[0].familyId) {
    return { code: -1, msg: '未加入家庭' }
  }

  const res = await db.collection('earnings').where({
    childOpenId,
    familyId: user.data[0].familyId
  })
    .orderBy('date', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return { code: 0, data: res.data }
}

// 获取收益日历（某月）
async function getEarningsCalendar(openid, data) {
  const childOpenId = data.childOpenId || openid
  const { year, month } = data
  if (!year || !month) {
    return { code: -1, msg: '请指定年月' }
  }

  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || !user.data[0].familyId) {
    return { code: -1, msg: '未加入家庭' }
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const res = await db.collection('earnings').where({
    childOpenId,
    familyId: user.data[0].familyId,
    date: _.gte(startDate).and(_.lt(endDate))
  }).orderBy('date', 'asc').get()

  return { code: 0, data: res.data }
}

// 获取收益趋势（最近N天）
async function getEarningsTrend(openid, data) {
  const childOpenId = data.childOpenId || openid
  const { days = 30 } = data
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || !user.data[0].familyId) {
    return { code: -1, msg: '未加入家庭' }
  }

  const now = new Date()
  const startDate = formatDate(new Date(now.getTime() - days * 86400000))

  const res = await db.collection('earnings').where({
    childOpenId,
    familyId: user.data[0].familyId,
    date: _.gte(startDate)
  }).orderBy('date', 'asc').get()

  return { code: 0, data: res.data }
}

// ========== 取现相关 ==========

// 小孩申请取现 - 提交给家庭所有家长
async function applyWithdraw(openid, data) {
  const { amount, reason = '' } = data
  if (!amount || amount <= 0) {
    return { code: -1, msg: '取现金额无效' }
  }

  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || user.data[0].role !== 'child') {
    return { code: -1, msg: '仅小孩可申请取现' }
  }
  if (!user.data[0].familyId) {
    return { code: -1, msg: '未加入家庭' }
  }

  // 获取存款
  const deposit = await db.collection('deposits').where({
    childOpenId: openid,
    familyId: user.data[0].familyId,
    status: 'active'
  }).get()

  if (deposit.data.length === 0) {
    return { code: -1, msg: '暂无存款记录' }
  }

  // 先计算最新收益
  await doCalcEarnings(deposit.data[0])

  // 重新获取更新后的存款
  const updatedDeposit = await db.collection('deposits').doc(deposit.data[0]._id).get()
  const totalAvailable = updatedDeposit.data.balance + updatedDeposit.data.totalEarnings

  if (amount > totalAvailable) {
    return { code: -1, msg: `可取金额不足，当前可取 ${totalAvailable.toFixed(2)} 元` }
  }

  // 检查是否有待审核的申请
  const pending = await db.collection('withdrawals').where({
    childOpenId: openid,
    status: 'pending'
  }).get()
  if (pending.data.length > 0) {
    return { code: -1, msg: '您有待审核的取现申请，请等待审核完成' }
  }

  const family = await db.collection('families').doc(user.data[0].familyId).get()
  const now = new Date()

  // 获取家庭所有家长列表
  const parentOpenIds = family.data.parentOpenIds || [family.data.parentOpenId]

  await db.collection('withdrawals').add({
    data: {
      depositId: deposit.data[0]._id,
      childOpenId: openid,
      parentOpenIds: parentOpenIds,    // 所有家长都可以审批
      familyId: user.data[0].familyId,
      amount,
      reason,
      status: 'pending',
      childName: user.data[0].nickName,
      createdAt: now,
      updatedAt: now
    }
  })

  return { code: 0, msg: '取现申请已提交，等待家长审批' }
}

// 家长审批取现 - 家庭内任一家长均可审批
async function reviewWithdraw(openid, data) {
  const { withdrawId, action } = data // action: 'approve' | 'reject'
  if (!withdrawId || !['approve', 'reject'].includes(action)) {
    return { code: -1, msg: '参数无效' }
  }

  // 验证家长身份
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || user.data[0].role !== 'parent') {
    return { code: -1, msg: '仅家长可审批' }
  }

  const withdrawal = await db.collection('withdrawals').doc(withdrawId).get()
  if (!withdrawal.data) {
    return { code: -1, msg: '审批记录不存在' }
  }

  // 检查该家长是否在该家庭中（支持多家长审批）
  const parentOpenIds = withdrawal.data.parentOpenIds || [withdrawal.data.parentOpenId]
  if (!parentOpenIds.includes(openid)) {
    // 兼容：同一家庭的家长也可以审批
    if (withdrawal.data.familyId !== user.data[0].familyId) {
      return { code: -1, msg: '无权审批该申请' }
    }
  }

  if (withdrawal.data.status !== 'pending') {
    return { code: -1, msg: '该申请已处理' }
  }

  const now = new Date()

  if (action === 'approve') {
    // 先计算收益
    const deposit = await db.collection('deposits').doc(withdrawal.data.depositId).get()
    await doCalcEarnings(deposit.data)

    // 重新获取更新后的存款
    const updatedDeposit = await db.collection('deposits').doc(withdrawal.data.depositId).get()
    const amount = withdrawal.data.amount

    // 扣减金额：优先扣本金，收益不直接扣减
    let newBalance = updatedDeposit.data.balance - amount
    let newTotalEarnings = updatedDeposit.data.totalEarnings

    // 如果本金不够扣，从收益中扣
    if (newBalance < 0) {
      newTotalEarnings = newTotalEarnings + newBalance // newBalance 是负数
      newBalance = 0
    }
    if (newTotalEarnings < 0) newTotalEarnings = 0

    await db.collection('deposits').doc(withdrawal.data.depositId).update({
      data: {
        balance: Math.round(newBalance * 100) / 100,
        totalEarnings: Math.round(newTotalEarnings * 100) / 100,
        lastCalcDate: formatDate(now),
        updatedAt: now
      }
    })
  }

  await db.collection('withdrawals').doc(withdrawId).update({
    data: {
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedBy: openid,   // 记录审批人
      reviewedAt: now,
      updatedAt: now
    }
  })

  return { code: 0, msg: action === 'approve' ? '已通过取现申请' : '已拒绝取现申请' }
}

// 获取取现记录
async function getWithdrawals(openid, data) {
  const { status, page = 1, pageSize = 20 } = data
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || !user.data[0].familyId) {
    return { code: -1, msg: '未加入家庭' }
  }

  const query = { familyId: user.data[0].familyId }

  // 小孩只能看自己的，家长看所有
  if (user.data[0].role === 'child') {
    query.childOpenId = openid
  }
  if (status) {
    query.status = status
  }

  const res = await db.collection('withdrawals')
    .where(query)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return { code: 0, data: res.data }
}

// 获取待审批数量 - 任一家长均可看到
async function getPendingCount(openid) {
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || user.data[0].role !== 'parent') {
    return { code: 0, data: { count: 0 } }
  }

  if (!user.data[0].familyId) {
    return { code: 0, data: { count: 0 } }
  }

  // 查找同一家庭的所有待审批记录
  const res = await db.collection('withdrawals').where({
    familyId: user.data[0].familyId,
    status: 'pending'
  }).count()

  return { code: 0, data: { count: res.total } }
}
