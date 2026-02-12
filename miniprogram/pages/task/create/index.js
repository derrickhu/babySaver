// 创建任务页（家长）
const api = require('../../../utils/api')
const util = require('../../../utils/util')

// 内置任务模板
const TASK_TEMPLATES = [
  {
    category: '家务劳动', icon: '🧹',
    tasks: [
      { title: '扫地拖地', reward: 5, description: '把客厅和房间的地板扫干净并拖一遍' },
      { title: '洗碗', reward: 3, description: '饭后把碗筷洗干净并放好' },
      { title: '整理房间', reward: 5, description: '把自己的房间整理干净整齐' },
      { title: '叠衣服', reward: 3, description: '把洗好的衣服叠好放进衣柜' },
      { title: '倒垃圾', reward: 2, description: '把家里的垃圾分类打包扔掉' },
      { title: '擦桌子', reward: 2, description: '饭前把桌子擦干净' }
    ]
  },
  {
    category: '学习成长', icon: '📚',
    tasks: [
      { title: '完成今日作业', reward: 5, description: '独立完成今天所有学科的作业' },
      { title: '阅读30分钟', reward: 5, description: '安静阅读课外书至少30分钟' },
      { title: '背诵课文', reward: 8, description: '流利背诵老师指定的课文' },
      { title: '练字一页', reward: 3, description: '工整地完成一页字帖练习' },
      { title: '英语单词打卡', reward: 5, description: '完成今日英语单词学习和背诵' },
      { title: '数学口算练习', reward: 3, description: '完成一组口算题并全部正确' }
    ]
  },
  {
    category: '生活习惯', icon: '⏰',
    tasks: [
      { title: '早起不赖床', reward: 3, description: '闹钟响后10分钟内起床' },
      { title: '按时睡觉', reward: 3, description: '晚上9:30前上床睡觉' },
      { title: '运动30分钟', reward: 5, description: '完成30分钟以上的体育锻炼' },
      { title: '自己穿衣洗漱', reward: 2, description: '早上独立完成穿衣刷牙洗脸' },
      { title: '好好吃饭', reward: 2, description: '不挑食，按时吃完正餐' }
    ]
  },
  {
    category: '特别挑战', icon: '🌟',
    tasks: [
      { title: '考试进步', reward: 20, description: '考试成绩比上次有进步' },
      { title: '学会新技能', reward: 15, description: '学会一项新技能（如骑车、游泳等）' },
      { title: '帮忙做饭', reward: 10, description: '协助家长完成一顿饭的制作' },
      { title: '独立完成大扫除', reward: 15, description: '独立完成房间的大扫除' },
      { title: '照顾弟弟妹妹', reward: 10, description: '帮忙照看弟弟妹妹1小时' }
    ]
  }
]

Page({
  data: {
    templates: TASK_TEMPLATES,
    expandedCategory: -1,
    // 表单
    title: '',
    description: '',
    reward: '',
    deadline: '',
    minDate: '',
    submitting: false,
    // 编辑模式
    isEdit: false,
    taskId: ''
  },

  onLoad(options) {
    // 默认截止日期为明天
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const minDate = util.formatDate(new Date())
    const defaultDeadline = util.formatDate(tomorrow)
    this.setData({ deadline: defaultDeadline, minDate })

    // 编辑模式：携带任务 id
    if (options.id) {
      this.setData({ isEdit: true, taskId: options.id })
      wx.setNavigationBarTitle({ title: '编辑任务' })
      this.loadTask(options.id)
    }
  },

  // 加载已有任务数据（编辑模式）
  async loadTask(taskId) {
    try {
      const res = await api.callCloud('getTaskDetail', { taskId })
      if (res.code === 0 && res.data) {
        const t = res.data
        const deadlineStr = util.formatDate(new Date(t.deadline))
        this.setData({
          title: t.title,
          description: t.description || '',
          reward: String(t.reward),
          deadline: deadlineStr
        })
      }
    } catch (err) {
      api.showError('加载任务失败')
    }
  },

  // 展开/折叠模板分类
  onToggleCategory(e) {
    const idx = e.currentTarget.dataset.index
    this.setData({
      expandedCategory: this.data.expandedCategory === idx ? -1 : idx
    })
  },

  // 选择模板 → 填入表单
  onSelectTemplate(e) {
    const { cindex, tindex } = e.currentTarget.dataset
    const task = this.data.templates[cindex].tasks[tindex]
    this.setData({
      title: task.title,
      description: task.description,
      reward: String(task.reward),
      expandedCategory: -1
    })
    // 滚动到表单区
    wx.pageScrollTo({ selector: '#form-section', duration: 300 })
  },

  // 表单绑定
  onTitleInput(e) { this.setData({ title: e.detail.value }) },
  onDescInput(e) { this.setData({ description: e.detail.value }) },
  onRewardInput(e) { this.setData({ reward: e.detail.value }) },
  onDeadlineChange(e) { this.setData({ deadline: e.detail.value }) },

  // 提交（创建或更新）
  async onSubmit() {
    const { title, description, reward, deadline, isEdit, taskId } = this.data
    const rewardNum = parseFloat(reward)

    if (!title.trim()) return api.showError('请填写任务名称')
    if (isNaN(rewardNum) || rewardNum <= 0) return api.showError('请设置有效的奖金金额')
    if (!deadline) return api.showError('请选择截止日期')

    this.setData({ submitting: true })
    api.showLoading(isEdit ? '保存中...' : '发布中...')

    try {
      const params = {
        title: title.trim(),
        description: description.trim(),
        reward: rewardNum,
        deadline
      }
      let res
      if (isEdit) {
        params.taskId = taskId
        res = await api.callCloud('updateTask', params)
      } else {
        res = await api.callCloud('createTask', params)
      }
      api.hideLoading()
      api.showToast(res.msg || (isEdit ? '保存成功' : '发布成功'))
      setTimeout(() => wx.navigateBack(), 800)
    } catch (err) {
      api.hideLoading()
      api.showError(err.msg || (isEdit ? '保存失败' : '发布失败'))
    } finally {
      this.setData({ submitting: false })
    }
  }
})
