// 首页 - 资产总览（参考微众银行）
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    isParent: false,
    hasFamily: false,
    loading: true,
    // 资产数据
    totalAssets: '0.00',
    totalEarnings: '0.00',
    yesterdayEarnings: '0.00',
    account: null,
    investments: [],
    pendingCount: 0,
    // 权限
    canDeposit: false,
    canReview: false,
    canProductManage: false,
    canTaskPublish: false,
    // 家长：小孩列表和当前选中
    children: [],
    selectedChildIndex: 0,
    selectedChildId: '',
    // 邀请码（家长无小孩时展示）
    inviteCode: '',
    family: null,
    // 未加入家庭时的输入
    inputCode: '',
    // 产品亮点弹窗
    showHighlights: false
  },

  onLoad() {
    this.checkLoginAndLoad()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    const app = getApp()
    if (app.globalData.isLoggedIn) {
      this.setData({ isLoggedIn: true, userInfo: app.globalData.userInfo })
      this.loadData()
    }
    // 创建家庭后触发产品亮点弹窗
    if (app.globalData.showHighlights) {
      app.globalData.showHighlights = false
      this.setData({ showHighlights: true })
    }
  },

  checkLoginAndLoad() {
    const app = getApp()
    if (app.globalData.isLoggedIn) {
      this.setData({ userInfo: app.globalData.userInfo, isLoggedIn: true })
      this.loadData()
    } else {
      app.loginCallback = (userInfo) => {
        this.setData({ userInfo, isLoggedIn: true })
        this.loadData()
      }
      // 未登录：不跳转登录页，展示访客视图（产品亮点介绍）
      setTimeout(() => {
        if (!app.globalData.isLoggedIn) {
          this.setData({ loading: false, isLoggedIn: false })
        }
      }, 3000)
    }
  },

  async loadData() {
    const app = getApp()
    const userInfo = app.globalData.userInfo
    if (!userInfo) return

    this.setData({
      userInfo,
      isParent: userInfo.role === 'parent',
      hasFamily: !!userInfo.familyId
    })

    if (!userInfo.familyId) {
      this.setData({ loading: false })
      return
    }

    try {
      if (userInfo.role === 'parent') {
        await this.loadParentData()
      } else {
        await this.loadChildData()
      }
    } catch (err) {
      console.error('加载数据失败:', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 家长：加载小孩列表，默认展示第一个小孩
  async loadParentData() {
    const [membersRes, pendingRes, familyRes] = await Promise.all([
      api.callCloud('getFamilyMembers'),
      api.callCloud('getPendingCount'),
      api.callCloud('getFamily')
    ])

    let children = (membersRes.data || []).filter(m => m.role === 'child')
    // 将 cloud:// fileID 转为临时 HTTPS URL，确保跨设备显示
    children = await api.resolveAvatars(children)

    // 解析权限
    let myPerms = { deposit: true, withdrawReview: true, productManage: true }
    if (familyRes.code === 0 && familyRes.data && familyRes.data.myPermissions) {
      myPerms = familyRes.data.myPermissions
    }

    const family = familyRes.code === 0 ? familyRes.data : null
    this.setData({
      children,
      pendingCount: pendingRes.data ? pendingRes.data.count : 0,
      canDeposit: myPerms.deposit,
      canReview: myPerms.withdrawReview,
      canProductManage: myPerms.productManage,
      canTaskPublish: myPerms.taskPublish,
      inviteCode: family ? family.inviteCode : '',
      family
    })

    if (children.length > 0) {
      const childId = children[this.data.selectedChildIndex]?._openid || children[0]._openid
      this.setData({ selectedChildId: childId })
      await this.loadAssetSummary(childId)
    }

  },

  // 小孩：加载自己的数据
  async loadChildData() {
    await this.loadAssetSummary()
  },

  // 加载资产总览
  async loadAssetSummary(childOpenId) {
    try {
      const params = childOpenId ? { childOpenId } : {}
      const res = await api.callCloud('getAssetSummary', params)
      if (res.code === 0 && res.data) {
        const d = res.data
        this.setData({
          totalAssets: util.formatMoney(d.totalAssets),
          totalEarnings: util.formatMoney(d.totalEarnings),
          yesterdayEarnings: util.formatMoney(d.yesterdayEarnings),
          account: d.account ? {
            ...d.account,
            balanceStr: util.formatMoney(d.account.balance),
            earningsStr: util.formatMoney(d.account.totalEarnings),
            totalValueStr: util.formatMoney(d.account.totalValue),
            dailyEarningStr: (d.account.balance * d.account.baseRate / 100 / 365).toFixed(4)
          } : null,
          investments: (d.investments || []).map(inv => ({
            ...inv,
            amountStr: util.formatMoney(inv.amount),
            earningsStr: util.formatMoney(inv.earnings),
            totalValueStr: util.formatMoney(inv.totalValue),
            rateStr: inv.rate + '%',
            dailyEarningStr: (inv.amount * inv.rate / 100 / 365).toFixed(4)
          }))
        })
      }
    } catch (err) {
      console.error('加载资产失败:', err)
    }
  },

  // 小孩头像加载失败（如过期 URL）时回退到 emoji
  onChildAvatarError() {
    const idx = this.data.selectedChildIndex
    const children = this.data.children.slice()
    if (!children[idx]) return
    children[idx] = { ...children[idx], avatarError: true }
    this.setData({ children })
  },

  // 家长切换小孩
  onChildChange(e) {
    const index = e.detail.value
    const child = this.data.children[index]
    if (child) {
      this.setData({
        selectedChildIndex: parseInt(index),
        selectedChildId: child._openid,
        loading: true
      })
      this.loadAssetSummary(child._openid).then(() => {
        this.setData({ loading: false })
      })
    }
  },

  // 导航
  goEarningsCalendar() {
    const childId = this.data.isParent ? this.data.selectedChildId : ''
    wx.navigateTo({ url: `/pages/earnings/calendar/index?childOpenId=${childId}` })
  },

  goBills() {
    wx.switchTab({ url: '/pages/earnings/index' })
  },

  goDeposit() {
    const childId = this.data.selectedChildId
    wx.navigateTo({ url: `/pages/deposit/index?childOpenId=${childId}` })
  },

  goWithdraw() {
    wx.navigateTo({ url: '/pages/withdraw/apply/index' })
  },

  goProductManage() {
    wx.navigateTo({ url: '/pages/product/manage/index' })
  },

  goProductDetail(e) {
    const productId = e.currentTarget.dataset.productid
    const investmentId = e.currentTarget.dataset.investmentid || ''
    wx.navigateTo({ url: `/pages/product/detail/index?productId=${productId}&investmentId=${investmentId}` })
  },

  goReview() {
    wx.navigateTo({ url: '/pages/withdraw/review/index' })
  },

  goFamily() {
    wx.navigateTo({ url: '/pages/family/index' })
  },

  // 未登录时主动去授权登录
  goLogin() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  // 未登录：选择身份后跳注册页，预设角色
  goRegisterWithRole(e) {
    const role = e.currentTarget.dataset.role
    wx.navigateTo({ url: `/pages/login/index?role=${role}` })
  },

  // 未加入家庭时的操作（与家庭管理页一致）
  onCodeInput(e) {
    this.setData({ inputCode: e.detail.value.toUpperCase() })
  },

  async onCreateFamily() {
    // 未登录时跳转注册页
    const app = getApp()
    if (!app.globalData.isLoggedIn) {
      return wx.navigateTo({ url: '/pages/login/index' })
    }
    // 小孩不能创建家庭
    if (app.globalData.userInfo && app.globalData.userInfo.role === 'child') {
      const api = require('../../utils/api')
      return api.showToast('小孩只能加入家庭哦')
    }
    const api = require('../../utils/api')
    api.showLoading('创建中...')
    try {
      const res = await api.callCloud('createFamily', {})
      api.hideLoading()

      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      app.globalData.userInfo = userRes.data
      // 创建家庭后直接加载首页数据（当前就在首页）
      this.loadData()
      // 直接触发亮点弹窗
      this.setData({ showHighlights: true })
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg)
    }
  },

  async onJoinFamily() {
    // 未登录时跳转注册页
    const app = getApp()
    if (!app.globalData.isLoggedIn) {
      return wx.navigateTo({ url: '/pages/login/index' })
    }
    const { inputCode } = this.data
    if (!inputCode || inputCode.length < 6) {
      const api = require('../../utils/api')
      return api.showToast('请输入完整的邀请码')
    }

    const api = require('../../utils/api')
    api.showLoading('加入中...')
    try {
      await api.callCloud('joinFamily', { inviteCode: inputCode })
      api.hideLoading()

      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      app.globalData.userInfo = userRes.data
      // 标记需要显示产品亮点
      app.globalData.showHighlights = true

      this.loadData()
      // 触发亮点弹窗（当前就在首页）
      this.setData({ showHighlights: true })
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg)
    }
  },

  // 复制邀请码
  onCopyInviteCode() {
    const { inviteCode } = this.data
    if (!inviteCode) return
    wx.setClipboardData({
      data: inviteCode,
      success: () => {
        const api = require('../../utils/api')
        api.showToast('邀请码已复制')
      }
    })
  },

  // 分享小程序（区分普通分享和邀请分享）
  onShareAppMessage(res) {
    // 仅通过「邀请」按钮触发时才带 inviteCode
    if (res.from === 'button') {
      const { inviteCode, family } = this.data
      if (inviteCode) {
        return {
          title: `邀请你加入「${family ? family.familyName : '我的'}」家庭，一起培养孩子的理财习惯`,
          path: `/pages/family/index?inviteCode=${inviteCode}`,
          imageUrl: '/images/avatar.png'
        }
      }
    }
    // 右上角菜单分享：普通分享，不带邀请码
    return {
      title: '小孩存钱宝 - 培养孩子的理财好习惯',
      path: '/pages/index/index',
      imageUrl: '/images/avatar.png'
    }
  },

  goProducts() {
    wx.navigateTo({ url: '/pages/product/manage/index' })
  },

  // 关闭产品亮点弹窗
  onCloseHighlights() {
    this.setData({ showHighlights: false })
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh())
  }
})
