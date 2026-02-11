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
      // 默认账户相关
      case 'getAccount': return await getAccount(openid, data)
      case 'getChildAccounts': return await getChildAccounts(openid)
      case 'depositToAccount': return await depositToAccount(openid, data)
      case 'setBaseRate': return await setBaseRate(openid, data)
      // 理财产品相关
      case 'createProduct': return await createProduct(openid, data)
      case 'updateProduct': return await updateProduct(openid, data)
      case 'getProducts': return await getProducts(openid)
      case 'getProductDetail': return await getProductDetail(openid, data)
      // 投资相关
      case 'buyProduct': return await buyProduct(openid, data)
      case 'redeemInvestment': return await redeemInvestment(openid, data)
      case 'getInvestments': return await getInvestments(openid, data)
      // 取现相关
      case 'applyWithdraw': return await applyWithdraw(openid, data)
      case 'reviewWithdraw': return await reviewWithdraw(openid, data)
      case 'getPendingCount': return await getPendingCount(openid)
      // 账单相关
      case 'getTransactions': return await getTransactions(openid, data)
      // 收益计算
      case 'calcAllEarnings': return await calcAllEarnings(openid, data)
      case 'getAssetSummary': return await getAssetSummary(openid, data)
      // 每日收益日历
      case 'getEarningsCalendar': return await getEarningsCalendar(openid, data)
      // 产品操作日志
      case 'getProductLogs': return await getProductLogs(openid, data)
      // 权限管理
      case 'getPermissions': return await getPermissions(openid)
      case 'updatePermissions': return await updatePermissions(openid, data)
      // 订阅消息
      case 'requestSubscribe': return await requestSubscribe(openid, data)
      default:
        return { code: -1, msg: '未知操作类型' }
    }
  } catch (err) {
    console.error(`[babySaver] type=${type} error:`, err)
    return { code: -1, msg: err.message || '服务器错误' }
  }
}

// ========== 工具函数 ==========

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1)
  const d2 = new Date(dateStr2)
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24))
}

function round2(n) {
  return Math.round(n * 100) / 100
}

// 获取用户并验证家庭
async function getUserWithFamily(openid) {
  const res = await db.collection('users').where({ _openid: openid }).get()
  if (res.data.length === 0) throw new Error('用户不存在')
  const user = res.data[0]
  if (!user.familyId) throw new Error('未加入家庭')
  return user
}

// 验证家长身份
async function verifyParent(openid) {
  const user = await getUserWithFamily(openid)
  if (user.role !== 'parent') throw new Error('仅家长可操作')
  return user
}

// 确保小孩有默认账户（没有则自动创建）
async function ensureAccount(childOpenId, familyId) {
  const existing = await db.collection('accounts').where({
    childOpenId, familyId, status: 'active'
  }).get()
  if (existing.data.length > 0) return existing.data[0]

  // 获取家庭默认利率
  const family = await db.collection('families').doc(familyId).get()
  const baseRate = family.data.baseRate || 2.0

  const now = new Date()
  const res = await db.collection('accounts').add({
    data: {
      childOpenId, familyId,
      balance: 0,
      baseRate,
      totalEarnings: 0,
      lastCalcDate: formatDate(now),
      status: 'active',
      createdAt: now,
      updatedAt: now
    }
  })
  const created = await db.collection('accounts').doc(res._id).get()
  return created.data
}

// 写入账单
async function addTransaction(txData) {
  const now = new Date()
  return await db.collection('transactions').add({
    data: {
      ...txData,
      createdAt: now,
      updatedAt: now
    }
  })
}

// 写入产品操作日志
async function addProductLog(logData) {
  const now = new Date()
  return await db.collection('productLogs').add({
    data: { ...logData, createdAt: now }
  })
}

// ========== 权限相关 ==========

// 权限类型
const PERMISSIONS = ['deposit', 'withdrawReview', 'productManage']

// 获取家庭权限配置（创建者始终拥有全部权限）
async function getFamilyPermissions(familyId) {
  const family = await db.collection('families').doc(familyId).get()
  const f = family.data
  const creatorId = f.creatorOpenId || f.parentOpenId
  // 如果没有权限配置，初始化为仅创建者
  const perms = f.permissions || {}
  return {
    deposit: perms.deposit || [creatorId],
    withdrawReview: perms.withdrawReview || [creatorId],
    productManage: perms.productManage || [creatorId],
    creatorOpenId: creatorId
  }
}

// 验证家长是否有指定权限（创建者始终有权限）
async function verifyParentPermission(openid, permType) {
  const user = await getUserWithFamily(openid)
  if (user.role !== 'parent') throw new Error('仅家长可操作')

  const family = await db.collection('families').doc(user.familyId).get()
  const creatorId = family.data.creatorOpenId || family.data.parentOpenId

  // 创建者始终有所有权限
  if (openid === creatorId) return user

  const perms = family.data.permissions || {}
  const allowedList = perms[permType] || [creatorId]
  if (!allowedList.includes(openid)) {
    const permNames = { deposit: '存入', withdrawReview: '取现审批', productManage: '产品管理' }
    throw new Error(`您没有「${permNames[permType] || permType}」权限，请联系家庭创建者授权`)
  }
  return user
}

// ========== 订阅消息通知 ==========

// 待办事项提醒：小孩取现 → 通知家长
// 关键词：thing1(事项名称), thing2(提醒内容), thing3(备注)
const WITHDRAW_TEMPLATE_ID = '5It1FyqknG1-gC4hKelmrgbZeHFpqD5p8cbtZio-_s8'

// 提现审核通知：家长审核完成 → 通知小孩
// 关键词：amount1(申请金额), phrase2(审核结果)
const REVIEW_RESULT_TEMPLATE_ID = 'GPmqW3cLc99XxTKVDX282D_-NwIYnQBOYJu2h1Y9Mwo'

// 通知家长：小孩申请取现
async function sendWithdrawNotification(familyId, childName, amount, remark) {
  try {
    const family = await db.collection('families').doc(familyId).get()

    // 获取有审批权限的家长
    const perms = family.data.permissions || {}
    const creatorId = family.data.creatorOpenId || family.data.parentOpenId
    const reviewers = perms.withdrawReview || [creatorId]
    if (reviewers.length === 0) return

    for (const parentId of reviewers) {
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: parentId,
          templateId: WITHDRAW_TEMPLATE_ID,
          page: '/pages/withdraw/review/index',
          data: {
            thing1: { value: '取现申请待审批' },
            thing2: { value: `${childName || '小孩'}申请取现¥${round2(amount)}` },
            thing3: { value: (remark || '取现申请').substring(0, 20) }
          }
        })
        console.log(`[通知] 已发送取现通知给家长 ${parentId}`)
      } catch (err) {
        console.log(`[通知] 发送失败 ${parentId}:`, err.errCode, err.errMsg)
      }
    }
  } catch (err) {
    console.error('[通知] 发送取现通知异常:', err)
  }
}

// 通知小孩：审核结果
async function sendReviewResultNotification(childOpenId, amount, approved) {
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: childOpenId,
      templateId: REVIEW_RESULT_TEMPLATE_ID,
      page: '/pages/withdraw/apply/index',
      data: {
        amount1: { value: `${round2(amount)}元` },
        phrase2: { value: approved ? '已通过' : '已拒绝' }
      }
    })
    console.log(`[通知] 已发送审核结果通知给小孩 ${childOpenId}`)
  } catch (err) {
    console.log(`[通知] 发送审核结果失败:`, err.errCode, err.errMsg)
  }
}

// 自动生成产品说明举例
function generateProductExample(rate, type, termDays) {
  const exampleAmount = 1000
  const dailyEarning = round2(exampleAmount * rate / 100 / 365)
  const monthlyEarning = round2(exampleAmount * rate / 100 / 12)
  let desc = `例：存入${exampleAmount}元，每天收益约${dailyEarning}元，每月约${monthlyEarning}元`
  if (type === 'fixed' && termDays > 0) {
    const totalEarning = round2(exampleAmount * rate / 100 / 365 * termDays)
    desc += `，${termDays}天到期总收益约${totalEarning}元`
  }
  return desc
}

// ========== 初始化集合 ==========

async function initCollections() {
  const collections = ['users', 'families', 'accounts', 'products', 'investments', 'transactions', 'earnings', 'productLogs']
  const results = []
  for (const name of collections) {
    try {
      await db.createCollection(name)
      results.push({ name, status: 'created' })
    } catch (err) {
      if (err.errCode === -502014) {
        results.push({ name, status: 'exists' })
      } else {
        results.push({ name, status: 'error', msg: err.message })
      }
    }
  }
  return { code: 0, msg: '集合初始化完成', data: results }
}

// ========== 用户相关（保持不变） ==========

const PARENT_TITLES = ['爸爸', '妈妈', '爷爷', '奶奶', '外公', '外婆', '其他']

async function register(openid, data) {
  const { nickName, role, parentTitle, avatarUrl } = data
  if (!nickName || !role) return { code: -1, msg: '昵称和角色不能为空' }
  if (!['parent', 'child'].includes(role)) return { code: -1, msg: '角色类型无效' }
  if (role === 'parent' && (!parentTitle || !PARENT_TITLES.includes(parentTitle))) {
    return { code: -1, msg: '请选择家长身份' }
  }

  const existing = await db.collection('users').where({ _openid: openid }).get()
  if (existing.data.length > 0) return { code: -1, msg: '用户已注册' }

  const now = new Date()
  const userData = {
    _openid: openid, nickName, role, familyId: '',
    avatarUrl: avatarUrl || '', createdAt: now, updatedAt: now
  }
  if (role === 'parent') userData.parentTitle = parentTitle

  await db.collection('users').add({ data: userData })
  return { code: 0, msg: '注册成功' }
}

async function getUserInfo(openid) {
  const res = await db.collection('users').where({ _openid: openid }).get()
  if (res.data.length === 0) return { code: 1, msg: '用户未注册', data: null }
  return { code: 0, data: res.data[0] }
}

async function updateParentTitle(openid, data) {
  const { parentTitle } = data
  if (!parentTitle || !PARENT_TITLES.includes(parentTitle)) {
    return { code: -1, msg: '请选择有效的家长身份' }
  }
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0) return { code: -1, msg: '用户不存在' }
  if (user.data[0].role !== 'parent') return { code: -1, msg: '仅家长可修改身份标识' }

  await db.collection('users').where({ _openid: openid }).update({
    data: { parentTitle, updatedAt: new Date() }
  })
  return { code: 0, msg: '身份修改成功' }
}

// ========== 家庭相关（保持不变） ==========

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

async function createFamily(openid, data) {
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || user.data[0].role !== 'parent') {
    return { code: -1, msg: '仅家长可创建家庭' }
  }
  if (user.data[0].familyId) return { code: -1, msg: '您已有家庭，无需重复创建' }

  const familyName = data.familyName || `${user.data[0].nickName}的家庭`
  let inviteCode = generateInviteCode()
  let exists = await db.collection('families').where({ inviteCode }).get()
  while (exists.data.length > 0) {
    inviteCode = generateInviteCode()
    exists = await db.collection('families').where({ inviteCode }).get()
  }

  const now = new Date()
  const familyRes = await db.collection('families').add({
    data: {
      familyName, inviteCode,
      creatorOpenId: openid,
      parentOpenIds: [openid],
      childOpenIds: [],
      baseRate: 2.0, // 默认账户基础年化利率
      permissions: {
        deposit: [openid],
        withdrawReview: [openid],
        productManage: [openid]
      },
      createdAt: now
    }
  })

  await db.collection('users').where({ _openid: openid }).update({
    data: { familyId: familyRes._id, updatedAt: now }
  })

  return { code: 0, msg: '家庭创建成功', data: { familyId: familyRes._id, inviteCode } }
}

async function joinFamily(openid, data) {
  const { inviteCode } = data
  if (!inviteCode) return { code: -1, msg: '请输入邀请码' }

  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0) return { code: -1, msg: '用户不存在' }
  if (user.data[0].familyId) return { code: -1, msg: '您已加入家庭' }

  const family = await db.collection('families').where({ inviteCode: inviteCode.toUpperCase() }).get()
  if (family.data.length === 0) return { code: -1, msg: '邀请码无效' }

  const familyId = family.data[0]._id
  const userRole = user.data[0].role
  const now = new Date()

  if (userRole === 'child') {
    await db.collection('families').doc(familyId).update({
      data: { childOpenIds: _.push(openid) }
    })
    // 小孩加入家庭时自动创建默认账户
    await ensureAccount(openid, familyId)
  } else if (userRole === 'parent') {
    await db.collection('families').doc(familyId).update({
      data: { parentOpenIds: _.push(openid) }
    })
  }

  await db.collection('users').where({ _openid: openid }).update({
    data: { familyId, updatedAt: now }
  })
  return { code: 0, msg: '加入家庭成功' }
}

async function getFamily(openid) {
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0) return { code: -1, msg: '用户不存在' }
  if (!user.data[0].familyId) return { code: 1, msg: '未加入家庭', data: null }

  const family = await db.collection('families').doc(user.data[0].familyId).get()
  const familyData = family.data
  const creatorId = familyData.creatorOpenId || familyData.parentOpenId
  familyData.isCreator = (creatorId === openid)
  if (!familyData.creatorOpenId && familyData.parentOpenId) {
    familyData.creatorOpenId = familyData.parentOpenId
  }
  if (!familyData.parentOpenIds && familyData.parentOpenId) {
    familyData.parentOpenIds = [familyData.parentOpenId]
  }
  // 补充当前用户的权限信息
  const perms = familyData.permissions || {}
  familyData.myPermissions = {
    deposit: familyData.isCreator || (perms.deposit || []).includes(openid),
    withdrawReview: familyData.isCreator || (perms.withdrawReview || []).includes(openid),
    productManage: familyData.isCreator || (perms.productManage || []).includes(openid)
  }
  return { code: 0, data: familyData }
}

async function getFamilyMembers(openid) {
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || !user.data[0].familyId) {
    return { code: -1, msg: '未加入家庭' }
  }
  const members = await db.collection('users').where({ familyId: user.data[0].familyId }).get()
  const family = await db.collection('families').doc(user.data[0].familyId).get()
  const creatorOpenId = family.data.creatorOpenId || family.data.parentOpenId
  const result = members.data.map(m => ({ ...m, isCreator: m._openid === creatorOpenId }))
  return { code: 0, data: result }
}

// ========== 默认账户相关 ==========

// 获取小孩的默认账户
async function getAccount(openid, data) {
  const childOpenId = data.childOpenId || openid
  const user = await getUserWithFamily(openid)

  const account = await ensureAccount(childOpenId, user.familyId)
  return { code: 0, data: account }
}

// 家长获取所有小孩账户
async function getChildAccounts(openid) {
  const user = await verifyParent(openid)
  const children = await db.collection('users').where({
    familyId: user.familyId, role: 'child'
  }).get()

  const accounts = []
  for (const child of children.data) {
    const account = await ensureAccount(child._openid, user.familyId)
    accounts.push({
      ...account,
      childName: child.nickName,
      childAvatarUrl: child.avatarUrl || ''
    })
  }
  return { code: 0, data: accounts }
}

// 家长存钱到小孩默认账户
async function depositToAccount(openid, data) {
  const { childOpenId, amount, remark } = data
  if (!childOpenId || !amount || amount <= 0) {
    return { code: -1, msg: '参数不完整' }
  }
  if (!remark || remark.trim() === '') {
    return { code: -1, msg: '请填写备注' }
  }

  const user = await verifyParentPermission(openid, 'deposit')

  // 验证小孩在同一家庭
  const child = await db.collection('users').where({ _openid: childOpenId }).get()
  if (child.data.length === 0 || child.data[0].familyId !== user.familyId) {
    return { code: -1, msg: '该小孩不在您的家庭中' }
  }

  const account = await ensureAccount(childOpenId, user.familyId)
  const now = new Date()

  // 增加余额
  await db.collection('accounts').doc(account._id).update({
    data: {
      balance: round2(account.balance + amount),
      updatedAt: now
    }
  })

  // 记录账单
  await addTransaction({
    childOpenId, familyId: user.familyId,
    type: 'deposit',
    amount: round2(amount),
    remark: remark.trim(),
    relatedId: '', relatedName: '默认账户',
    status: 'success',
    createdBy: openid,
    childName: child.data[0].nickName
  })

  return { code: 0, msg: `已存入 ¥${round2(amount)}` }
}

// 家庭管理员设置默认账户基础利率
async function setBaseRate(openid, data) {
  const { baseRate } = data
  if (baseRate === undefined || baseRate < 0 || baseRate > 100) {
    return { code: -1, msg: '利率设置不合法（0-100）' }
  }

  const user = await verifyParent(openid)

  // 验证是创建者
  const family = await db.collection('families').doc(user.familyId).get()
  if (family.data.creatorOpenId !== openid) {
    return { code: -1, msg: '仅家庭创建者可设置基础利率' }
  }

  // 更新家庭利率
  await db.collection('families').doc(user.familyId).update({
    data: { baseRate: round2(baseRate) }
  })

  // 同步更新所有小孩的默认账户利率
  await db.collection('accounts').where({
    familyId: user.familyId, status: 'active'
  }).update({ data: { baseRate: round2(baseRate), updatedAt: new Date() } })

  return { code: 0, msg: '基础利率设置成功' }
}

// ========== 理财产品相关 ==========

const RISK_LEVELS = ['low', 'medium', 'high']
const RISK_LABELS = { low: '低风险', medium: '中风险', high: '高风险' }
const PRODUCT_TYPES = ['demand', 'fixed']

// 家长创建理财产品（家庭维度）
async function createProduct(openid, data) {
  const { name, riskLevel, type, rate, termDays, minAmount, description } = data
  if (!name || !riskLevel || !type || rate === undefined) {
    return { code: -1, msg: '参数不完整' }
  }
  if (!RISK_LEVELS.includes(riskLevel)) return { code: -1, msg: '风险等级无效' }
  if (!PRODUCT_TYPES.includes(type)) return { code: -1, msg: '产品类型无效' }
  if (rate < 0 || rate > 100) return { code: -1, msg: '利率不合法' }
  if (type === 'fixed' && (!termDays || termDays <= 0)) {
    return { code: -1, msg: '定期产品请设置投资天数' }
  }

  const user = await verifyParentPermission(openid, 'productManage')
  const now = new Date()
  const actualRate = round2(rate)
  const actualTermDays = type === 'fixed' ? parseInt(termDays) : 0

  // 自动生成举例说明
  const autoExample = generateProductExample(actualRate, type, actualTermDays)
  const finalDesc = (description || '').trim()
    ? (description.trim() + '\n' + autoExample)
    : autoExample

  const productRes = await db.collection('products').add({
    data: {
      familyId: user.familyId,
      name: name.trim(),
      riskLevel,
      type,
      rate: actualRate,
      termDays: actualTermDays,
      minAmount: round2(minAmount || 0),
      description: finalDesc,
      autoTransfer: { enabled: false, amount: 0, period: 'monthly' },
      status: 'active',
      createdBy: openid,
      createdAt: now,
      updatedAt: now
    }
  })

  // 记录产品操作日志
  await addProductLog({
    familyId: user.familyId,
    productId: productRes._id,
    productName: name.trim(),
    action: 'create',
    detail: `创建理财产品「${name.trim()}」，年化${actualRate}%，${type === 'demand' ? '活期' : '定期' + actualTermDays + '天'}`,
    operatorId: openid,
    operatorName: user.nickName || ''
  })

  return { code: 0, msg: '理财产品创建成功', data: { productId: productRes._id } }
}

// 家长修改理财产品
async function updateProduct(openid, data) {
  const { productId, ...updates } = data
  if (!productId) return { code: -1, msg: '产品ID不能为空' }

  const user = await verifyParentPermission(openid, 'productManage')

  const product = await db.collection('products').doc(productId).get()
  if (!product.data || product.data.familyId !== user.familyId) {
    return { code: -1, msg: '产品不存在' }
  }

  const oldProduct = product.data
  const allowedFields = ['name', 'riskLevel', 'type', 'rate', 'termDays', 'minAmount', 'description', 'status', 'autoTransfer']
  const updateData = { updatedAt: new Date() }
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      updateData[key] = updates[key]
    }
  }
  if (updateData.rate !== undefined) updateData.rate = round2(updateData.rate)
  if (updateData.minAmount !== undefined) updateData.minAmount = round2(updateData.minAmount)

  // 如果利率变了，重新生成举例说明
  if (updateData.rate !== undefined || updateData.type !== undefined || updateData.termDays !== undefined) {
    const newRate = updateData.rate !== undefined ? updateData.rate : oldProduct.rate
    const newType = updateData.type !== undefined ? updateData.type : oldProduct.type
    const newTermDays = updateData.termDays !== undefined ? updateData.termDays : oldProduct.termDays
    const autoExample = generateProductExample(newRate, newType, newTermDays)
    // 保留用户自定义描述（第一行），替换自动举例（以"例："开头的行）
    const userDesc = (updateData.description || oldProduct.description || '').split('\n').filter(l => !l.startsWith('例：')).join('\n').trim()
    updateData.description = userDesc ? (userDesc + '\n' + autoExample) : autoExample
  }

  await db.collection('products').doc(productId).update({ data: updateData })

  // 记录操作日志
  let action = 'update'
  let detail = '修改了产品信息'
  if (updates.status === 'inactive') {
    action = 'offline'
    detail = `下线了理财产品「${oldProduct.name}」`
  } else if (updates.status === 'active' && oldProduct.status === 'inactive') {
    action = 'online'
    detail = `上线了理财产品「${oldProduct.name}」`
  } else {
    const changes = []
    if (updates.name && updates.name !== oldProduct.name) changes.push(`名称→${updates.name}`)
    if (updates.rate !== undefined && updates.rate !== oldProduct.rate) changes.push(`利率→${round2(updates.rate)}%`)
    if (updates.riskLevel && updates.riskLevel !== oldProduct.riskLevel) changes.push(`风险→${RISK_LABELS[updates.riskLevel]}`)
    detail = changes.length > 0 ? `修改「${oldProduct.name}」：${changes.join('，')}` : `修改了「${oldProduct.name}」`
  }
  await addProductLog({
    familyId: user.familyId,
    productId,
    productName: updateData.name || oldProduct.name,
    action,
    detail,
    operatorId: openid,
    operatorName: user.nickName || ''
  })

  return { code: 0, msg: '产品更新成功' }
}

// 获取家庭的理财产品列表
async function getProducts(openid) {
  const user = await getUserWithFamily(openid)

  const products = await db.collection('products').where({
    familyId: user.familyId
  }).orderBy('createdAt', 'desc').get()

  // 添加风险标签
  const result = products.data.map(p => ({
    ...p,
    riskLabel: RISK_LABELS[p.riskLevel] || p.riskLevel,
    typeLabel: p.type === 'demand' ? '活期' : `定期${p.termDays}天`
  }))

  return { code: 0, data: result }
}

// 获取产品详情
async function getProductDetail(openid, data) {
  const { productId } = data
  if (!productId) return { code: -1, msg: '产品ID不能为空' }

  const user = await getUserWithFamily(openid)
  const product = await db.collection('products').doc(productId).get()
  if (!product.data || product.data.familyId !== user.familyId) {
    return { code: -1, msg: '产品不存在' }
  }

  const result = {
    ...product.data,
    riskLabel: RISK_LABELS[product.data.riskLevel] || product.data.riskLevel,
    typeLabel: product.data.type === 'demand' ? '活期' : `定期${product.data.termDays}天`
  }

  return { code: 0, data: result }
}

// ========== 投资相关 ==========

// 小孩购买理财产品（从默认账户扣款）
async function buyProduct(openid, data) {
  const { productId, amount } = data
  if (!productId || !amount || amount <= 0) {
    return { code: -1, msg: '参数不完整' }
  }

  const user = await getUserWithFamily(openid)
  if (user.role !== 'child') return { code: -1, msg: '仅小孩可购买理财' }

  const product = await db.collection('products').doc(productId).get()
  if (!product.data || product.data.familyId !== user.familyId) {
    return { code: -1, msg: '产品不存在' }
  }
  if (product.data.status !== 'active') return { code: -1, msg: '该产品已停售' }
  if (product.data.minAmount && amount < product.data.minAmount) {
    return { code: -1, msg: `最低买入 ¥${product.data.minAmount}` }
  }

  // 检查默认账户余额
  const account = await ensureAccount(openid, user.familyId)
  if (account.balance < amount) {
    return { code: -1, msg: `默认账户余额不足，当前 ¥${round2(account.balance)}` }
  }

  const now = new Date()
  const today = formatDate(now)

  // 扣减默认账户余额
  await db.collection('accounts').doc(account._id).update({
    data: { balance: round2(account.balance - amount), updatedAt: now }
  })

  // 创建投资记录
  const endDate = product.data.type === 'fixed'
    ? formatDate(new Date(now.getTime() + product.data.termDays * 86400000))
    : ''

  await db.collection('investments').add({
    data: {
      childOpenId: openid,
      productId,
      productName: product.data.name,
      familyId: user.familyId,
      amount: round2(amount),
      rate: product.data.rate,
      earnings: 0,
      lastCalcDate: today,
      startDate: today,
      endDate,
      status: 'active',
      createdAt: now,
      updatedAt: now
    }
  })

  // 记录账单
  await addTransaction({
    childOpenId: openid, familyId: user.familyId,
    type: 'buy',
    amount: round2(amount),
    remark: `买入${product.data.name}`,
    relatedId: productId, relatedName: product.data.name,
    status: 'success',
    createdBy: openid,
    childName: user.nickName
  })

  return { code: 0, msg: `已买入 ${product.data.name} ¥${round2(amount)}` }
}

// 赎回投资（活期随时赎回，定期到期后赎回）
async function redeemInvestment(openid, data) {
  const { investmentId } = data
  if (!investmentId) return { code: -1, msg: '投资ID不能为空' }

  const user = await getUserWithFamily(openid)
  if (user.role !== 'child') return { code: -1, msg: '仅小孩可赎回' }

  const investment = await db.collection('investments').doc(investmentId).get()
  if (!investment.data || investment.data.childOpenId !== openid) {
    return { code: -1, msg: '投资记录不存在' }
  }
  if (investment.data.status !== 'active' && investment.data.status !== 'matured') {
    return { code: -1, msg: '该投资已赎回' }
  }

  // 定期产品检查是否到期
  if (investment.data.endDate) {
    const today = formatDate(new Date())
    if (today < investment.data.endDate && investment.data.status !== 'matured') {
      return { code: -1, msg: `定期产品未到期，到期日：${investment.data.endDate}` }
    }
  }

  // 先计算最新收益
  await doCalcInvestmentEarnings(investment.data)

  // 重新获取
  const updated = await db.collection('investments').doc(investmentId).get()
  const redeemAmount = round2(updated.data.amount + updated.data.earnings)
  const now = new Date()

  // 标记投资为已赎回
  await db.collection('investments').doc(investmentId).update({
    data: { status: 'redeemed', updatedAt: now }
  })

  // 赎回金额回到默认账户
  const account = await ensureAccount(openid, user.familyId)
  await db.collection('accounts').doc(account._id).update({
    data: { balance: round2(account.balance + redeemAmount), updatedAt: now }
  })

  // 记录账单
  await addTransaction({
    childOpenId: openid, familyId: user.familyId,
    type: 'redeem',
    amount: redeemAmount,
    remark: `赎回${investment.data.productName}`,
    relatedId: investment.data.productId, relatedName: investment.data.productName,
    status: 'success',
    createdBy: openid,
    childName: user.nickName
  })

  return { code: 0, msg: `已赎回 ¥${redeemAmount}（本金 ¥${updated.data.amount} + 收益 ¥${round2(updated.data.earnings)}）` }
}

// 获取小孩的投资持仓
async function getInvestments(openid, data) {
  const childOpenId = data.childOpenId || openid
  const user = await getUserWithFamily(openid)

  const investments = await db.collection('investments').where({
    childOpenId, familyId: user.familyId,
    status: _.in(['active', 'matured'])
  }).orderBy('createdAt', 'desc').get()

  return { code: 0, data: investments.data }
}

// ========== 取现相关（重写，基于 accounts） ==========

async function applyWithdraw(openid, data) {
  const { amount, remark } = data
  if (!amount || amount <= 0) return { code: -1, msg: '取现金额无效' }
  if (!remark || remark.trim() === '') return { code: -1, msg: '请填写备注' }

  const user = await getUserWithFamily(openid)
  if (user.role !== 'child') return { code: -1, msg: '仅小孩可申请取现' }

  const account = await ensureAccount(openid, user.familyId)

  // 先计算最新收益
  await doCalcAccountEarnings(account)
  const updatedAccount = await db.collection('accounts').doc(account._id).get()
  const available = round2(updatedAccount.data.balance + updatedAccount.data.totalEarnings)

  if (amount > available) {
    return { code: -1, msg: `可取金额不足，当前可取 ¥${available}` }
  }

  // 检查是否有待审核
  const pending = await db.collection('transactions').where({
    childOpenId: openid, type: 'withdraw', status: 'pending'
  }).get()
  if (pending.data.length > 0) {
    return { code: -1, msg: '您有待审核的取现申请，请等待审核完成' }
  }

  await addTransaction({
    childOpenId: openid, familyId: user.familyId,
    type: 'withdraw',
    amount: round2(amount),
    remark: remark.trim(),
    relatedId: account._id, relatedName: '默认账户',
    status: 'pending',
    createdBy: openid,
    childName: user.nickName
  })

  // 异步通知有审批权限的家长（不阻塞主流程）
  sendWithdrawNotification(user.familyId, user.nickName, amount, remark.trim()).catch(() => {})

  return { code: 0, msg: '取现申请已提交，等待家长审批' }
}

async function reviewWithdraw(openid, data) {
  const { transactionId, action } = data
  if (!transactionId || !['approve', 'reject'].includes(action)) {
    return { code: -1, msg: '参数无效' }
  }

  const user = await verifyParentPermission(openid, 'withdrawReview')
  const tx = await db.collection('transactions').doc(transactionId).get()
  if (!tx.data || tx.data.familyId !== user.familyId) {
    return { code: -1, msg: '记录不存在' }
  }
  if (tx.data.type !== 'withdraw' || tx.data.status !== 'pending') {
    return { code: -1, msg: '该申请已处理' }
  }

  const now = new Date()

  if (action === 'approve') {
    const account = await db.collection('accounts').where({
      childOpenId: tx.data.childOpenId, familyId: user.familyId, status: 'active'
    }).get()
    if (account.data.length === 0) return { code: -1, msg: '账户不存在' }

    await doCalcAccountEarnings(account.data[0])
    const updated = await db.collection('accounts').doc(account.data[0]._id).get()
    const amt = tx.data.amount

    // 优先扣余额，不够扣收益
    let newBalance = updated.data.balance - amt
    let newEarnings = updated.data.totalEarnings
    if (newBalance < 0) {
      newEarnings = newEarnings + newBalance
      newBalance = 0
    }
    if (newEarnings < 0) newEarnings = 0

    await db.collection('accounts').doc(account.data[0]._id).update({
      data: {
        balance: round2(newBalance),
        totalEarnings: round2(newEarnings),
        updatedAt: now
      }
    })
  }

  await db.collection('transactions').doc(transactionId).update({
    data: {
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedBy: openid,
      reviewedAt: now,
      updatedAt: now
    }
  })

  // 异步通知小孩审核结果
  sendReviewResultNotification(tx.data.childOpenId, tx.data.amount, action === 'approve').catch(() => {})

  return { code: 0, msg: action === 'approve' ? '已通过取现申请' : '已拒绝取现申请' }
}

async function getPendingCount(openid) {
  const user = await db.collection('users').where({ _openid: openid }).get()
  if (user.data.length === 0 || user.data[0].role !== 'parent' || !user.data[0].familyId) {
    return { code: 0, data: { count: 0 } }
  }

  const res = await db.collection('transactions').where({
    familyId: user.data[0].familyId,
    type: 'withdraw',
    status: 'pending'
  }).count()

  return { code: 0, data: { count: res.total } }
}

// ========== 账单相关 ==========

async function getTransactions(openid, data) {
  const { childOpenId, type, page = 1, pageSize = 20 } = data
  const user = await getUserWithFamily(openid)

  const query = { familyId: user.familyId }

  // 指定小孩或自己
  if (childOpenId) {
    query.childOpenId = childOpenId
  } else if (user.role === 'child') {
    query.childOpenId = openid
  }

  if (type) query.type = type

  const res = await db.collection('transactions')
    .where(query)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return { code: 0, data: res.data }
}

// ========== 收益计算 ==========

// 计算默认账户收益
async function doCalcAccountEarnings(account) {
  const now = new Date()
  const today = formatDate(now)
  if (account.lastCalcDate >= today) return

  const days = daysBetween(account.lastCalcDate, today)
  if (days <= 0) return

  const dailyRate = account.baseRate / 100 / 365
  let totalEarnings = account.totalEarnings || 0
  const records = []

  for (let i = 1; i <= days; i++) {
    const calcDate = new Date(new Date(account.lastCalcDate).getTime() + i * 86400000)
    const dateStr = formatDate(calcDate)
    const dailyEarning = round2(account.balance * dailyRate)
    totalEarnings = round2(totalEarnings + dailyEarning)

    records.push({
      accountId: account._id,
      childOpenId: account.childOpenId,
      familyId: account.familyId,
      source: 'account',
      date: dateStr,
      balance: account.balance,
      rate: account.baseRate,
      dailyEarning,
      totalEarnings,
      createdAt: now
    })
  }

  // 批量写入
  for (let i = 0; i < records.length; i += 20) {
    const batch = records.slice(i, i + 20)
    await Promise.all(batch.map(r => db.collection('earnings').add({ data: r })))
  }

  await db.collection('accounts').doc(account._id).update({
    data: { totalEarnings, lastCalcDate: today, updatedAt: now }
  })
}

// 计算单个投资的收益（到期后继续计算收益，不自动停止）
async function doCalcInvestmentEarnings(investment) {
  const now = new Date()
  const today = formatDate(now)
  if (investment.lastCalcDate >= today) return

  const days = daysBetween(investment.lastCalcDate, today)
  if (days <= 0) return

  const dailyRate = investment.rate / 100 / 365
  let earnings = investment.earnings || 0
  const records = []

  for (let i = 1; i <= days; i++) {
    const calcDate = new Date(new Date(investment.lastCalcDate).getTime() + i * 86400000)
    const dateStr = formatDate(calcDate)
    const dailyEarning = round2(investment.amount * dailyRate)
    earnings = round2(earnings + dailyEarning)

    records.push({
      investmentId: investment._id,
      productId: investment.productId,
      productName: investment.productName,
      childOpenId: investment.childOpenId,
      familyId: investment.familyId,
      source: 'investment',
      date: dateStr,
      balance: investment.amount,
      rate: investment.rate,
      dailyEarning,
      totalEarnings: earnings,
      createdAt: now
    })
  }

  // 批量写入收益记录
  for (let i = 0; i < records.length; i += 20) {
    const batch = records.slice(i, i + 20)
    await Promise.all(batch.map(r => db.collection('earnings').add({ data: r })))
  }

  const updateData = { earnings, lastCalcDate: today, updatedAt: now }
  // 标记是否已到期（但仍继续计算收益）
  if (investment.endDate && today >= investment.endDate && investment.status === 'active') {
    updateData.status = 'matured'
  }

  await db.collection('investments').doc(investment._id).update({ data: updateData })
}

// 计算小孩的所有收益（默认账户 + 所有投资）
async function calcAllEarnings(openid, data) {
  const childOpenId = data.childOpenId || openid
  const user = await getUserWithFamily(openid)

  // 计算默认账户收益
  const account = await ensureAccount(childOpenId, user.familyId)
  await doCalcAccountEarnings(account)

  // 计算所有活跃投资的收益
  const investments = await db.collection('investments').where({
    childOpenId, familyId: user.familyId,
    status: _.in(['active', 'matured'])
  }).get()

  for (const inv of investments.data) {
    await doCalcInvestmentEarnings(inv)
  }

  return { code: 0, msg: '收益计算完成' }
}

// 获取资产总览（首页核心接口）
async function getAssetSummary(openid, data) {
  const childOpenId = data.childOpenId || openid
  const user = await getUserWithFamily(openid)

  // 先计算所有收益
  await calcAllEarnings(openid, { childOpenId })

  // 获取默认账户
  const account = await ensureAccount(childOpenId, user.familyId)
  const refreshedAccount = await db.collection('accounts').doc(account._id).get()
  const acc = refreshedAccount.data

  // 获取所有活跃投资
  const investments = await db.collection('investments').where({
    childOpenId, familyId: user.familyId,
    status: _.in(['active', 'matured'])
  }).get()

  // 计算总资产
  let investmentTotal = 0
  let investmentEarnings = 0
  const investmentList = investments.data.map(inv => {
    investmentTotal += inv.amount + inv.earnings
    investmentEarnings += inv.earnings
    return {
      ...inv,
      totalValue: round2(inv.amount + inv.earnings)
    }
  })

  const totalAssets = round2(acc.balance + acc.totalEarnings + investmentTotal)
  const totalEarnings = round2(acc.totalEarnings + investmentEarnings)

  // 获取昨日收益
  const yesterday = formatDate(new Date(Date.now() - 86400000))
  const yesterdayEarnings = await db.collection('earnings').where({
    childOpenId, familyId: user.familyId, date: yesterday
  }).get()
  let yesterdayTotal = 0
  yesterdayEarnings.data.forEach(e => { yesterdayTotal += e.dailyEarning || 0 })

  return {
    code: 0,
    data: {
      totalAssets,
      totalEarnings,
      yesterdayEarnings: round2(yesterdayTotal),
      account: {
        ...acc,
        totalValue: round2(acc.balance + acc.totalEarnings)
      },
      investments: investmentList
    }
  }
}

// ========== 每日收益日历 ==========

async function getEarningsCalendar(openid, data) {
  const { childOpenId: cid, year, month, source } = data
  const childOpenId = cid || openid
  if (!year || !month) return { code: -1, msg: '请指定年月' }

  const user = await getUserWithFamily(openid)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const query = {
    childOpenId,
    familyId: user.familyId,
    date: _.gte(startDate).and(_.lt(endDate))
  }
  if (source) query.source = source

  const res = await db.collection('earnings').where(query)
    .orderBy('date', 'asc').limit(1000).get()

  // 按日期聚合
  const dayMap = {}
  res.data.forEach(e => {
    if (!dayMap[e.date]) {
      dayMap[e.date] = { date: e.date, totalEarning: 0, details: [] }
    }
    dayMap[e.date].totalEarning = round2(dayMap[e.date].totalEarning + (e.dailyEarning || 0))
    dayMap[e.date].details.push({
      source: e.source,
      productName: e.productName || '默认账户',
      dailyEarning: e.dailyEarning,
      balance: e.balance,
      rate: e.rate
    })
  })

  const calendarData = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))

  // 月度总收益
  let monthTotal = 0
  calendarData.forEach(d => { monthTotal += d.totalEarning })

  return { code: 0, data: { calendar: calendarData, monthTotal: round2(monthTotal) } }
}

// ========== 产品操作日志 ==========

async function getProductLogs(openid, data) {
  const { productId, page = 1, pageSize = 30 } = data
  const user = await getUserWithFamily(openid)

  const query = { familyId: user.familyId }
  if (productId) query.productId = productId

  const res = await db.collection('productLogs')
    .where(query)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return { code: 0, data: res.data }
}

// ========== 权限管理 ==========

// 获取权限配置（含各家长详情）
async function getPermissions(openid) {
  const user = await verifyParent(openid)
  const family = await db.collection('families').doc(user.familyId).get()
  const creatorId = family.data.creatorOpenId || family.data.parentOpenId

  // 获取所有家长
  const parents = await db.collection('users').where({
    familyId: user.familyId, role: 'parent'
  }).get()

  const perms = family.data.permissions || {}
  const depositList = perms.deposit || [creatorId]
  const withdrawReviewList = perms.withdrawReview || [creatorId]
  const productManageList = perms.productManage || [creatorId]

  const parentList = parents.data.map(p => ({
    openid: p._openid,
    nickName: p.nickName,
    parentTitle: p.parentTitle || '家长',
    avatarUrl: p.avatarUrl || '',
    isCreator: p._openid === creatorId,
    permissions: {
      deposit: p._openid === creatorId || depositList.includes(p._openid),
      withdrawReview: p._openid === creatorId || withdrawReviewList.includes(p._openid),
      productManage: p._openid === creatorId || productManageList.includes(p._openid)
    }
  }))

  return { code: 0, data: { parents: parentList, isCreator: openid === creatorId } }
}

// 创建者修改其他家长权限
async function updatePermissions(openid, data) {
  const { targetOpenId, permType, enabled } = data
  if (!targetOpenId || !permType || !PERMISSIONS.includes(permType)) {
    return { code: -1, msg: '参数无效' }
  }

  const user = await verifyParent(openid)
  const family = await db.collection('families').doc(user.familyId).get()
  const creatorId = family.data.creatorOpenId || family.data.parentOpenId

  if (openid !== creatorId) {
    return { code: -1, msg: '仅家庭创建者可管理权限' }
  }
  if (targetOpenId === creatorId) {
    return { code: -1, msg: '创建者始终拥有全部权限' }
  }

  // 验证目标是同家庭的家长
  const target = await db.collection('users').where({ _openid: targetOpenId }).get()
  if (target.data.length === 0 || target.data[0].familyId !== user.familyId || target.data[0].role !== 'parent') {
    return { code: -1, msg: '目标用户不是家庭内的家长' }
  }

  const perms = family.data.permissions || {}
  let list = perms[permType] || [creatorId]

  if (enabled) {
    if (!list.includes(targetOpenId)) list.push(targetOpenId)
  } else {
    list = list.filter(id => id !== targetOpenId)
  }

  // 确保创建者始终在列表中
  if (!list.includes(creatorId)) list.push(creatorId)

  const updateObj = {}
  updateObj[`permissions.${permType}`] = list

  await db.collection('families').doc(user.familyId).update({ data: updateObj })

  const permNames = { deposit: '存入', withdrawReview: '取现审批', productManage: '产品管理' }
  const targetName = target.data[0].nickName || '家长'
  return {
    code: 0,
    msg: `已${enabled ? '授权' : '取消'}${targetName}的「${permNames[permType]}」权限`
  }
}

// 获取订阅消息模板ID（前端据此请求用户授权）
async function requestSubscribe(openid, data) {
  const user = await db.collection('users').where({ _openid: openid }).get()
  const role = user.data.length > 0 ? user.data[0].role : ''

  // 家长需要：取现申请通知
  // 小孩需要：审核结果通知
  const templateIds = []
  if (role === 'parent') {
    templateIds.push(WITHDRAW_TEMPLATE_ID)
  } else if (role === 'child') {
    templateIds.push(REVIEW_RESULT_TEMPLATE_ID)
  }
  return { code: 0, msg: 'ok', data: { templateIds } }
}
