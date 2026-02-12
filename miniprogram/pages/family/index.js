// 家庭管理页
const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    isParent: false,
    hasFamily: false,
    isCreator: false,
    family: null,
    members: [],
    inviteCode: '',
    inputCode: '',
    loading: true
  },

  onLoad(options) {
    this.shareInviteCode = options.inviteCode || ''
    this.loadData()
  },

  // 分享到微信群/好友（创建者邀请成员时使用）
  onShareAppMessage() {
    const { inviteCode, family, isCreator } = this.data
    if (!isCreator || !inviteCode) {
      return { title: '小孩存钱宝 - 培养孩子的理财好习惯' }
    }
    return {
      title: `邀请你加入「${family ? family.familyName : '我的'}」家庭，一起培养孩子的理财习惯`,
      path: `/pages/family/index?inviteCode=${inviteCode}`
    }
  },

  onShow() {
    if (!this.data.loading) {
      this.loadData()
    }
  },

  // 加载数据
  async loadData() {
    const app = getApp()
    const userInfo = app.globalData.userInfo
    if (!userInfo) {
      // 未登录时跳转登录页，携带 inviteCode 确保注册后能自动加入家庭
      const inviteParam = this.shareInviteCode ? `?inviteCode=${this.shareInviteCode}` : ''
      wx.redirectTo({ url: `/pages/login/index${inviteParam}` })
      return
    }

    this.setData({
      userInfo,
      isParent: userInfo.role === 'parent',
      hasFamily: !!userInfo.familyId
    })

    if (userInfo.familyId) {
      try {
        const [familyRes, membersRes] = await Promise.all([
          api.callCloud('getFamily'),
          api.callCloud('getFamilyMembers')
        ])

        if (familyRes.code === 0) {
          this.setData({
            family: familyRes.data,
            inviteCode: familyRes.data.inviteCode,
            isCreator: !!familyRes.data.isCreator
          })
        }
        if (membersRes.code === 0) {
          let memberList = membersRes.data.map(m => ({
            ...m,
            roleText: util.getMemberRoleText(m),
            emoji: util.getMemberEmoji(m)
          }))
          // 将 cloud:// fileID 转为临时 HTTPS URL，确保跨设备显示
          memberList = await api.resolveAvatars(memberList)
          this.setData({ members: memberList })
        }
      } catch (err) {
        console.error('加载家庭信息失败:', err)
      }
    } else if (this.shareInviteCode) {
      // 从分享链接进入且未加入家庭时，自动加入家庭
      await this.autoJoinByInviteCode(this.shareInviteCode)
      this.shareInviteCode = '' // 只尝试一次，避免重复
      return // autoJoinByInviteCode 内部会重新 loadData
    }

    this.setData({ loading: false })
  },

  // 通过分享链接中的邀请码自动加入家庭
  async autoJoinByInviteCode(inviteCode) {
    this.setData({ loading: true })
    try {
      await api.callCloud('joinFamily', { inviteCode: inviteCode.toUpperCase() })
      api.showToast('已加入家庭')

      // 刷新用户信息后重新加载页面
      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      app.globalData.userInfo = userRes.data

      // 加入成功，跳转首页
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' })
      }, 800)
    } catch (err) {
      // 加入失败（如邀请码无效、已加入家庭等），回退到手动输入模式
      this.setData({
        loading: false,
        inputCode: inviteCode.toUpperCase()
      })
      if (err.msg === '您已加入家庭') {
        // 已在家庭中，刷新页面显示家庭信息
        const app = getApp()
        const userRes = await api.callCloud('getUserInfo')
        app.globalData.userInfo = userRes.data
        this.loadData()
      } else {
        api.showError(err.msg || '自动加入失败，请手动输入邀请码')
      }
    }
  },

  // 开启消息通知（必须在 tap 事件中同步调用）
  async onEnableNotify() {
    // 根据角色订阅不同模板
    const tmplIds = []
    if (this.data.isParent) {
      tmplIds.push(api.TMPL_WITHDRAW)  // 取现申请通知
      tmplIds.push(api.TMPL_MEMBER)    // 成员变动通知
    } else {
      tmplIds.push(api.TMPL_REVIEW)    // 审核结果通知
    }
    // 微信限制单次最多 3 个模板
    const res = await api.requestSubscribe(tmplIds.slice(0, 3))
    // 检查结果告知用户
    const accepted = Object.values(res).filter(v => v === 'accept').length
    if (accepted > 0) {
      api.showToast('通知已开启')
    } else {
      api.showToast('请在弹窗中点击"允许"')
    }
  },

  // 成员头像加载失败时降级到 emoji
  onMemberAvatarError(e) {
    const idx = e.currentTarget.dataset.index
    const members = this.data.members.slice()
    if (members[idx]) {
      members[idx] = { ...members[idx], avatarError: true }
      this.setData({ members })
    }
  },

  // 创建家庭（家长）
  async onCreateFamily() {
    api.showLoading('创建中...')
    try {
      const res = await api.callCloud('createFamily', {})
      api.hideLoading()
      api.showToast('家庭创建成功')

      // 刷新用户信息
      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      app.globalData.userInfo = userRes.data

      this.loadData()
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg)
    }
  },

  // 输入邀请码
  onCodeInput(e) {
    this.setData({ inputCode: e.detail.value.toUpperCase() })
  },

  // 加入家庭（小孩或家长均可）
  async onJoinFamily() {
    const { inputCode } = this.data
    if (!inputCode || inputCode.length < 6) {
      return api.showToast('请输入完整的邀请码')
    }

    api.showLoading('加入中...')
    try {
      const res = await api.callCloud('joinFamily', { inviteCode: inputCode })
      api.hideLoading()
      api.showToast('加入家庭成功')

      // 刷新用户信息
      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      app.globalData.userInfo = userRes.data

      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' })
      }, 800)
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg)
    }
  },

  // 复制邀请码（仅管理员可用）
  onCopyCode() {
    if (!this.data.isCreator) {
      return api.showToast('仅家庭管理员可分享邀请码')
    }
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        api.showToast('邀请码已复制')
      }
    })
  },

  // 权限管理
  goPermissions() {
    wx.navigateTo({ url: '/pages/family/permissions/index' })
  },

  // 转让管理员
  async onTransferAdmin() {
    if (!this.data.isCreator) {
      return api.showToast('仅管理员可操作')
    }

    // 获取其他家长成员
    const otherParents = this.data.members.filter(
      m => m.role === 'parent' && !m.isCreator
    )

    if (otherParents.length === 0) {
      return api.showToast('暂无其他家长可转让')
    }

    const names = otherParents.map(p => p.nickName || '家长')
    wx.showActionSheet({
      itemList: names,
      success: async (res) => {
        const target = otherParents[res.tapIndex]
        if (!target) return

        const confirmRes = await new Promise(resolve => {
          wx.showModal({
            title: '转让管理员',
            content: `确定将管理员转让给「${target.nickName}」？转让后您将失去管理员权限。`,
            confirmText: '确定转让',
            confirmColor: '#FF4D4F',
            success: resolve
          })
        })

        if (!confirmRes.confirm) return

        api.showLoading('处理中...')
        try {
          const r = await api.callCloud('transferAdmin', { targetOpenId: target._openid })
          api.hideLoading()
          api.showToast(r.msg || '转让成功')
          this.loadData()
        } catch (err) {
          api.hideLoading()
          api.showError(err.msg || '转让失败')
        }
      }
    })
  },

  // 退出家庭（非管理员）
  async onLeaveFamily() {
    if (this.data.isCreator) {
      return api.showToast('管理员请使用解散家庭')
    }

    const confirmRes = await new Promise(resolve => {
      wx.showModal({
        title: '退出家庭',
        content: '退出后，您在该家庭的存款和收益数据将被清除。确定要退出吗？',
        confirmText: '确定退出',
        confirmColor: '#FF4D4F',
        success: resolve
      })
    })

    if (!confirmRes.confirm) return

    api.showLoading('退出中...')
    try {
      await api.callCloud('leaveFamily')
      api.hideLoading()
      api.showToast('已退出家庭')

      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      app.globalData.userInfo = userRes.data

      this.loadData()
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg)
    }
  },

  // 解散家庭（仅管理员）
  async onDisbandFamily() {
    if (!this.data.isCreator) {
      return api.showToast('仅家庭管理员可解散家庭')
    }

    const confirmRes = await new Promise(resolve => {
      wx.showModal({
        title: '解散家庭',
        content: '解散后，所有成员的账户、理财产品、收益等数据将被清除，且不可恢复。确定要解散吗？',
        confirmText: '确定解散',
        confirmColor: '#FF4D4F',
        success: resolve
      })
    })

    if (!confirmRes.confirm) return

    api.showLoading('解散中...')
    try {
      await api.callCloud('disbandFamily')
      api.hideLoading()
      api.showToast('家庭已解散')

      const app = getApp()
      const userRes = await api.callCloud('getUserInfo')
      app.globalData.userInfo = userRes.data

      this.loadData()
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg)
    }
  },

  // 返回首页
  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
