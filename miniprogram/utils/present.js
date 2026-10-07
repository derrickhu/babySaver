const { formatNum, formatYuan, formatRate, formatPctPoints, formatTime } = require('./format')

const LABELS = {
  dau: '日活',
  total_dau: '日活',
  active_users: '活跃',
  active_users_1h: '近1小时活跃',
  new_users: '新增',
  new_users_today: '新增',
  game_new_users: '新增',
  total_new_users: '新增',
  retention_d1_rate: '次留',
  retention_d7_rate: '7留',
  d1_retention: '次留',
  d7_retention: '7留',
  minutes_per_user: '人均时长',
  avg_session_ms: '平均会话',
  median_session_ms: '会话中位',
  session_cnt: '会话数',
  play_users: '游玩人数',
  total_show: '曝光',
  total_click: '点击',
  total_complete: '完播',
  total_request: '请求',
  total_error: '错误',
  total_errors: '错误数',
  total_revenue_estimated_cny: '估算收入',
  ad_revenue_estimated_cny: '估算收入',
  revenue_estimated_cny: '估算收入',
  estimated_ad_revenue_cny: '估算收入',
  arpdau_estimated_cny: '人均日收入',
  arpu_estimated_cny: '人均收入',
  avg_ltv_estimated_cny: '人均用户价值',
  ctr: '点击率',
  completion_rate: '完播率',
  fill_rate: '填充率',
  error_rate: '错误率',
  avg_ecpm_cny: '千次曝光收入',
  ecpm_cny: '千次曝光收入',
  actual_ecpm_cny: '真实千次曝光收入',
  ad_uau: '看广告人数',
  ad_penetration_rate: '广告渗透',
  ad_show_per_uu: '人均曝光',
  ad_show_cnt: '曝光',
  ad_show_per_ad_user: '广告用户人均曝光',
  ad_show_per_active_user: '活跃人均曝光',
  ipm: '千次安装',
  share_count: '分享次数',
  share_users: '分享人数',
  share_penetration_rate: '分享渗透',
  share_per_user: '人均分享',
  total_spend_cny: '消耗',
  spend_cny: '消耗',
  latest_recorded_spend_cny: '最近录入消耗',
  baseline_avg_spend_cny: '基线日均消耗',
  recommended_min_cny: '建议下限',
  recommended_max_cny: '建议上限',
  reference_spend_cny: '参考消耗',
  cpi_cny: '单个新增成本',
  avg_cpi_cny: '单个新增成本',
  target_cpi_cny: '目标新增成本',
  hard_stop_cpi_cny: '熔断新增成本',
  break_even_cpi_cny: '打平新增成本',
  cpc_cny: '单次点击成本',
  avg_cpc_cny: '单次点击成本',
  d0_roi: '首日回本',
  d3_roi: '3日回本',
  d7_roi: '7日回本',
  d0_roas: '首日广告回报',
  projected_d30_roas: '预测30日广告回报',
  d0_margin_cny: '首日毛利',
  total_d0_margin_cny: '首日毛利',
  d3_ltv_cny: '3日用户价值',
  d7_ltv_cny: '7日用户价值',
  projected_d30_ltv_cny: '预测30日用户价值',
  d30_projected_ltv_cny: '预测30日用户价值',
  d30_projected_roi: '预测30日回本',
  early_d30_ltv_cny: '早期30日用户价值',
  early_d30_roi: '早期30日回本',
  blended_ltv_d0: '首日用户价值',
  blended_ltv_d1: '次日用户价值',
  blended_ltv_d3: '3日用户价值',
  blended_ltv_d7: '7日用户价值',
  blended_ltv_d14: '14日用户价值',
  blended_ltv_d30: '30日用户价值',
  projected_ltv_d30: '预测30日用户价值',
  projected_ltv_d60: '预测60日用户价值',
  d0: '首日',
  d1: '次日',
  d3: '3日',
  d7: '7日',
  d14: '14日',
  d30: '30日',
  d60: '60日',
  total_cohort_size: '同期人数',
  cohort_size: '人数',
  total_observed_revenue_cny: '已观测收入',
  observed_cny: '已观测收入',
  wechat_ad_revenue_cny: '微信收入',
  douyin_ad_revenue_cny: '抖音收入',
  total_wechat_revenue_cny: '微信收入',
  total_real_revenue_cny: '真实收入',
  expected_d30_revenue_cny: '预期30日收入',
  expected_d30_profit_cny: '预期30日利润',
  t1_revenue_cny: '昨日收入',
  month_t1_revenue_cny: '当月收入',
  user_count: '玩家数',
  avg_level: '平均等级',
  max_level: '最高等级',
  avg_dau: '日均日活',
  total_days: '天数',
  active_user_days: '活跃人天',
  ad_user_days: '广告人天',
  sample_days: '样本天数',
  valid_sample_days: '有效样本',
  attributed_users: '归因用户',
  paid_or_known_users: '付费/已知',
  organic_users: '自然量',
  unknown_users: '未知',
  click_id_users: '带点击标识',
  reengaged_users: '回流用户',
  touch_events: '触点次数',
  users: '用户',
  count: '次数',
  user_cnt: '人数',
  level: '等级',
  bucket: '区间',
  scene: '场景',
  ad_type: '广告位',
  entry_point: '入口',
  latest_title: '最近标题',
  err_code: '错误码',
  err_msg: '错误信息',
  affected_users: '影响人数',
  data_status_label: '状态',
  action_label: '动作',
  conclusion: '结论',
  headline: '结论',
  verdict_label: '判断',
  issue_label: '问题',
  confidence: '置信度',
  primary_problem: '主因',
  decision: '决策',
  date_key: '日期',
  cohort_date: '日期',
  snapshot_date: '快照日',
  display_name: '游戏',
  game_key: '游戏',
  status: '状态',
  fetched: '拉取',
  inserted: '入库',
  duration_ms: '耗时',
  local_deleted: '本地删除',
  cloud_deleted: '云端删除',
  trigger_source: '来源',
  totalEvents: '事件总量',
  last24hEvents: '近24小时事件',
  source_collection: '云集合',
  has_data: '有数据',
  tutorial_completed_rate: '新手完成率',
  checkin_active_rate: '签到活跃率',
  note: '说明',
  summary: '汇总',
  kpi: '指标',
  commercial_decision: '投放决策',
  budget_recommendation: '预算建议',
  commercial_summary: '商业化结论',
  monetization_flow: '变现链路',
  core_metrics: '核心指标',
  baseline: '基线',
  diagnostics: '诊断',
  quality: '质量分布',
  rankings: '计划排行',
  daily_cohorts: '分日新增',
  reengagement_summary: '回流汇总',
  reengagement_daily: '回流分日',
  reengagement_by_provider: '回流来源',
  distribution: '分布',
  level_distribution: '等级分布',
  breakdown_by_scene: '广告场景',
  breakdown_by_entry: '分享入口',
  errors: '广告错误',
  rows: '明细',
  runs: '记录',
  recent_runs: '最近拉取',
  games: '游戏',
  stats: '事件库',
  daily_trend: '每日趋势',
  series: '趋势',
  series_hourly: '小时趋势',
  series_daily: '分日趋势',
  funnel: '漏斗',
  steps: '步骤',
  channels: '渠道',
  tiers: '档位',
  reasons: '原因',
  next_steps: '下一步',
  key_reasons: '依据',
  actions: '动作',
  key_findings: '发现',
  optimization_suggestions: '建议',
  play_minutes: '游玩时长',
  duration_source: '时长口径',
  ad_complete_cnt: '广告完播',
  ad_request_cnt: '广告请求',
  ad_click_cnt: '广告点击',
  ad_error_cnt: '广告错误',
  tower_start_cnt: '爬塔开始',
  tower_clear_cnt: '爬塔通关',
  tower_clear_rate: '爬塔通关率',
  tower_reset_cnt: '塔重置',
  max_floor: '最高层',
  computed_at: '计算时间',
  outing_start_cnt: '出门次数',
  outing_complete_cnt: '收摊次数',
  outing_abandon_cnt: '放弃出门',
  outing_complete_rate: '收摊回家率',
  outing_users: '出门人数',
  avg_outing_ms: '场均出门',
  run_start_cnt: '开局次数',
  run_clear_cnt: '通关次数',
  run_fail_cnt: '失败次数',
  run_clear_rate: '通关率',
  run_users: '开局人数',
  avg_run_ms: '场均时长',
  endless_start_cnt: '无尽开局',
  endless_users: '无尽人数',
  max_endless_wave: '最高波次',
  new_users: '新用户',
  returning_users: '老玩家',
  bounce_rate: '1分钟流失',
  first_match_rate: '首次消除率',
  first_level_clear_rate: '首关通过率',
  first_run_rate: '进首局率',
  tutorial_clear_rate: '教学通关率',
  took_loot_rate: '捡菜率',
  tutorial_done_rate: '引导完成率',
  cold_start: '新手漏斗',
  mismatch: '节奏对照',
  session_buckets: '会话分布',
  floor_bands: '层段',
  wall_floors: '卡关层',
  battle_modes: '战斗模式',
  ad_scenes: '广告位',
  exchanges: '兑换',
  markets: '菜场',
  dungeons: '副本',
  daily: '分日',
  shows: '曝光',
  completes: '完播',
  complete_rate: '完播率',
  starts: '开始',
  clears: '通关',
  fails: '失败',
  band_label: '层段',
  avg_coins: '场均印记',
  difficulty: '难度',
  difficulty_mid: '层中难度',
  mode: '模式',
  avg_turns: '场均回合',
  option_id: '商品',
  cost_sum: '印记消耗',
  market_id: '菜场',
  start_cnt: '开始次数',
  start_users: '开始人数',
  complete_cnt: '完成次数',
  abandon_cnt: '放弃次数',
  avg_duration_ms: '场均时长',
  avg_item_count: '场均带回',
  safe_cnt: '主动收工',
  messy_cnt: '天黑被赶',
  dungeon_id: '副本',
  kind: '类型',
  fail_cnt: '失败次数',
  avg_wave: '场均波次',
  max_wave: '最高波',
  level_name: '关卡',
  clear_users: '通关人数',
  retry_per_user: '人均重试',
  avg_turns_clear: '通关回合',
  avg_turns_fail: '失败回合',
  brand: '品牌',
  step_id: '步骤',
  prop_type: '道具',
  use_rate: '使用率',
  requests: '请求',
  uses: '使用',
  range_label: '分数段',
  unique_users: '覆盖玩家',
  hour: '小时',
  minute: '时间',
  platform: '平台',
  device_type: '设备',
  device_brand: '品牌',
  device_model: '机型',
  app_version: '版本',
  event_name: '事件',
  user_id: '用户编号',
  anonymous_id: '匿名编号',
}

const WORDS = {
  play: '游玩', minutes: '分钟', duration: '时长', source: '来源', ad: '广告', complete: '完成',
  cnt: '次数', count: '次数', tower: '爬塔', start: '开始', clear: '通关', rate: '率', reset: '重置',
  max: '最高', floor: '层', computed: '计算', at: '时间', users: '人数', user: '用户', session: '会话',
  avg: '平均', median: '中位', new: '新增', returning: '回流', bounce: '流失', first: '首次',
  match: '消除', level: '关卡', run: '开局', tutorial: '引导', done: '完成', took: '捡到', loot: '战利品',
  outing: '出门', abandon: '放弃', endless: '无尽', wave: '波次', show: '曝光', shows: '曝光',
  request: '请求', click: '点击', error: '错误', errors: '错误', revenue: '收入', estimated: '估算',
  cny: '元', scene: '场景', scenes: '场景', band: '层段', bands: '层段', wall: '卡关', floors: '层',
  battle: '战斗', modes: '模式', mode: '模式', exchange: '兑换', exchanges: '兑换', market: '菜场',
  markets: '菜场', dungeon: '副本', dungeons: '副本', daily: '分日', cold: '新手', mismatch: '对照',
  bucket: '区间', buckets: '分布', coin: '印记', coins: '印记', difficulty: '难度', mid: '中位',
  turn: '回合', turns: '回合', option: '商品', cost: '消耗', sum: '合计', item: '物品', safe: '安全',
  messy: '慌乱', kind: '类型', fail: '失败', fails: '失败', name: '名称', retry: '重试', brand: '品牌',
  step: '步骤', prop: '道具', type: '类型', use: '使用', uses: '使用', range: '区间', unique: '去重',
  hour: '小时', minute: '分钟', platform: '平台', device: '设备', model: '机型', app: '应用',
  version: '版本', event: '事件', anonymous: '匿名', id: '编号', total: '合计', active: '活跃',
  retention: '留存', share: '分享', penetration: '渗透', spend: '消耗', margin: '毛利', profit: '利润',
  projected: '预测', early: '早期', blended: '混合', observed: '已观测', wechat: '微信', douyin: '抖音',
  organic: '自然', unknown: '未知', paid: '付费', known: '已知', attributed: '归因', touch: '触点',
  events: '事件', inserted: '入库', fetched: '拉取', local: '本地', cloud: '云端', deleted: '删除',
  trigger: '触发', status: '状态', label: '名称', action: '动作', conclusion: '结论', headline: '结论',
  verdict: '判断', issue: '问题', confidence: '置信度', primary: '主要', problem: '问题', decision: '决策',
  date: '日期', key: '键', snapshot: '快照', display: '显示', game: '游戏', note: '说明', summary: '汇总',
  kpi: '指标', commercial: '商业', budget: '预算', recommendation: '建议', monetization: '变现',
  flow: '流转', core: '核心', metrics: '指标', baseline: '基线', diagnostics: '诊断', quality: '质量',
  rankings: '排行', reengagement: '回流', provider: '来源', distribution: '分布', breakdown: '分布',
  entry: '入口', rows: '明细', runs: '记录', recent: '最近', stats: '统计', trend: '趋势', series: '趋势',
  hourly: '小时', funnel: '漏斗', steps: '步骤', channels: '渠道', tiers: '档位', reasons: '原因',
  next: '下一步', findings: '发现', optimization: '优化', suggestions: '建议', fill: '填充',
  completion: '完播', ecpm: '千次曝光收入', ctr: '点击率', arpdau: '人均日收入', arpu: '人均收入',
  ltv: '用户价值', roi: '回本', roas: '广告回报', cpi: '新增成本', cpc: '点击成本', ipm: '千次安装',
  per: '人均', ms: '毫秒', today: '今日', size: '规模', cohort: '同期', sample: '样本', valid: '有效',
  days: '天', day: '天', points: '点', point: '点', age: '日龄', complete: '完成', is: '',
  victory: '胜利', double: '翻倍', home: '回城', quest: '日常', revive: '复活', realm: '秘境',
  extra: '额外', stamina: '体力', refill: '回复', free: '免费', gacha: '召唤', pull: '抽取',
  checkin: '签到', mainline: '主线', other: '其他', chapter: '章节', elite: '精英', grassland: '草原',
  forest: '密林', fortress: '要塞', swamp: '毒沼', dragon: '龙岭', bloodfang: '血牙', interstitial: '插屏',
  reward: '激励', banner: '横幅', classic: '经典', rank: '排行', skin: '皮肤', settings: '设置',
  shop: '商店', pack: '礼包', marks: '印记', ratio: '比值', late: '后期', grind: '挂机',
  welcome: '欢迎', continue: '继续', coach: '引导', hint: '提示', battle: '战斗', enter: '进入',
  touch: '触屏', pass: '通过', skip: '跳过', done: '完成', request: '请求', timeout: '超时',
  success: '成功', failed: '失败', pending: '进行中', running: '进行中', ok: '成功',
  close: '关闭', open: '打开', end: '结束', leave: '离开', buy: '购买', sell: '出售',
  claim: '领取', finish: '结束', begin: '开始', hide: '隐藏', load: '加载', init: '初始化',
  login: '登录', logout: '退出', invite: '邀请', pay: '支付', reward: '奖励', click: '点击',
}

const VALUES = {
  reconstructed_idle_gap: '按空闲间隔还原',
  unknown: '未知',
  Unknown: '未知',
  wechat: '微信',
  douyin: '抖音',
  taptap: '塔普',
  TapTap: '塔普',
  huawei: '华为',
  ios: '苹果手机',
  iOS: '苹果手机',
  android: '安卓手机',
  Android: '安卓手机',
  harmonyos: '鸿蒙',
  HarmonyOS: '鸿蒙',
  ipad: '苹果平板',
  iPad: '苹果平板',
  'Android Pad': '安卓平板',
  mainline: '主线',
  tower: '通天塔',
  realm: '秘境',
  other: '其他',
  chapter: '章节',
  elite: '精英',
  endless: '无尽',
  reward: '激励视频',
  banner: '横幅',
  interstitial: '插屏',
  level: '闯关',
  classic: '经典',
  rank: '排行榜',
  skin: '皮肤',
  settings: '设置',
  game_club: '游戏圈',
  victory_double: '结算翻倍',
  victory_home: '结算回城',
  quest_double: '日常翻倍',
  battle_revive: '战斗复活',
  realm_extra_run: '秘境加次',
  stamina_refill: '体力回复',
  free_gacha_pull: '免费召唤',
  checkin_double: '签到翻倍',
  tower_reset: '通天塔重置',
  tex_coins: '印记兑灵宠币',
  tex_lingyu: '印记兑灵玉',
  tex_universal: '印记兑通用碎片',
  extraDeploy: '广告多上一人',
  revive: '局内复活',
  lootRefresh: '刷新战利品',
  shopRefresh: '刷新商店',
  basket: '菜篮解锁',
  stamina: '回复体力',
  special: '特殊菜场',
  colorBlast: '同色爆破',
  crossClear: '十字清场',
  wildNext: '万能预备',
  xiangko: '巷口收摊',
  heyan: '河沿早市',
  qiaotou: '桥头早市',
  shanwu: '山坞早集',
  jiangbian: '江边渔市',
  nanshi: '南门菜市',
  laocheng: '老城菜行',
  dukou: '渡口渔行',
  shanzhen: '山珍行',
  dungeon_grassland: '草原战线',
  dungeon_forest: '密林深处',
  dungeon_fortress: '要塞攻防',
  dungeon_swamp: '毒沼泥潭',
  dungeon_dragon: '龙岭绝巅',
  dungeon_bloodfang: '血牙祭坛',
  dungeon_endless: '无尽试炼',
  elite_grassland: '草原精英',
  elite_forest: '密林精英',
  elite_fortress: '要塞精英',
  elite_swamp: '毒沼精英',
  elite_dragon: '龙岭精英',
  elite_bloodfang: '血牙精英',
  success: '成功',
  failed: '失败',
  failure: '失败',
  running: '进行中',
  pending: '等待中',
  ok: '正常',
  error: '出错',
  dry_run: '预演',
  manual: '手动',
  schedule: '定时',
  scheduled: '定时',
  hotpot: '别捞水果',
  huahua: '花花妙屋',
  caizhu: '彩珠五连',
  petTower: '灵宠消消塔',
  xiaochu: '灵宠消消塔',
  wujin_wenzhang: '无尽纹章',
  cunkou: '村口大战外星人',
  jiancai: '扫荡菜场',
  blackrosa: '墨字防线',
}

const HIDDEN = new Set([
  'ok', 'query', 'code', 'estimated', 'points', 'params_json', 'error', 'notice',
  'projection_method', 'd30_roas_basis', 'merged_err_codes', 'is_dual_emit',
])

const ALREADY_PERCENT = new Set([
  'fill_rate', 'completion_rate', 'error_rate', 'ctr',
  'ad_penetration_rate', 'share_penetration_rate',
])
const RATE_KEY = /_rate$|_roi$|roas|retention/
const MONEY_KEY = /cny|revenue|spend|ltv|cpi|cpc|ecpm|arpu|arpdau|cost|margin|profit/
const TIME_KEY = /_ts$|_at$|computed_at|event_ts|started_at|finished_at|last_seen_ts|last_active_at|oldestEventTs|newestEventTs/

let seq = 0

function label(key) {
  const raw = String(key || '')
  if (!raw) return '指标'
  if (LABELS[raw]) return LABELS[raw]
  const snake = raw.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toLowerCase()
  if (LABELS[snake]) return LABELS[snake]
  const parts = snake.split('_').filter(Boolean)
  const words = parts.map((part) => {
    if (WORDS[part]) return WORDS[part]
    if (/^\d+$/.test(part)) return part
    return ''
  }).filter(Boolean)
  return words.join('') || '其他'
}

function scrub(text) {
  return String(text)
    .replace(/\bLTV\b/g, '用户价值')
    .replace(/\bROAS\b/g, '广告回报')
    .replace(/\bROI\b/g, '回本')
    .replace(/\bARPDAU\b/g, '人均日收入')
    .replace(/\bARPU\b/g, '人均收入')
    .replace(/\beCPM\b/g, '千次曝光收入')
    .replace(/\bCPI\b/g, '新增成本')
    .replace(/\bCPC\b/g, '点击成本')
    .replace(/\bIPM\b/g, '千次安装')
    .replace(/\bD60\b/g, '60日')
    .replace(/\bD30\b/g, '30日')
    .replace(/\bD14\b/g, '14日')
    .replace(/\bD7\b/g, '7日')
    .replace(/\bD3\b/g, '3日')
    .replace(/\bD1\b/g, '次日')
    .replace(/\bD0\b/g, '首日')
    .replace(/\bAI\b/g, '智能')
    .replace(/\bcohort\b/gi, '同期')
    .replace(/(\d+\.\d{3,})(?=\s*元)/g, (matched) => Number(matched).toFixed(2))
}

function phrase(value) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? '是' : '否'
  const text = String(value).trim()
  if (!text) return '-'
  if (VALUES[text]) return scrub(VALUES[text])
  if (LABELS[text]) return scrub(LABELS[text])
  if (/[\u4e00-\u9fff]/.test(text)) return scrub(text)
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(text)) return scrub(label(text))
  return scrub(text)
}

function isScalar(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
}

function formatValue(key, value) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'number') {
    if (TIME_KEY.test(key) && value > 1e11) return formatTime(value)
    if (/_ms$/.test(key) || key === 'duration_ms') {
      const sec = Math.round(value / 1000)
      if (sec < 60) return `${sec}秒`
      const rest = sec % 60
      return rest ? `${Math.floor(sec / 60)}分${rest}秒` : `${Math.floor(sec / 60)}分`
    }
    if (/minutes/.test(key)) return `${Number(value).toFixed(1)}分钟`
    if (ALREADY_PERCENT.has(key)) return formatPctPoints(value)
    if (RATE_KEY.test(key)) return formatRate(value)
    if (MONEY_KEY.test(key)) return formatYuan(value)
    if (Number.isInteger(value)) return formatNum(value)
    return value.toFixed(2)
  }
  const raw = String(value).trim()
  if (MONEY_KEY.test(key) && /^-?\d+(\.\d+)?$/.test(raw)) return formatYuan(Number(raw))
  if (key === 'user_id' || key === 'anonymous_id' || key === 'err_msg' || key === 'note' || key === 'latest_title') {
    return raw.length > 28 ? `${raw.slice(0, 26)}…` : raw
  }
  const text = phrase(raw)
  return text.length > 28 ? `${text.slice(0, 26)}…` : text
}

function shortTime(value) {
  const text = String(value || '')
  const matched = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(text)
  if (!matched) return text.slice(0, 16)
  if (!matched[4]) return `${Number(matched[2])}/${Number(matched[3])}`
  const date = new Date(Date.UTC(+matched[1], +matched[2] - 1, +matched[3], +matched[4], +matched[5]))
  const p = (n) => (n < 10 ? `0${n}` : `${n}`)
  return `${date.getMonth() + 1}/${date.getDate()} ${p(date.getHours())}:${p(date.getMinutes())}`
}

function blank(title, extra) {
  seq += 1
  return Object.assign({
    id: `${title}-${seq}`,
    title,
    notice: '',
    error: '',
    kpis: [],
    bars: [],
    lines: [],
    cards: [],
    chart: null,
    table: null,
  }, extra)
}

const CURVE_COLORS = ['#1F4B99', '#078A4D', '#E11D48', '#B45309', '#0E8F98']

function familyOf(key) {
  if (ALREADY_PERCENT.has(key)) return 'pct'
  if (RATE_KEY.test(key)) return 'rate'
  if (MONEY_KEY.test(key)) return 'yuan'
  return 'count'
}

function chartFrom(rows, labelKey, metrics, axis) {
  const points = rows || []
  if (points.length < 2) return null
  const series = (metrics || []).map((metric, index) => ({
    name: metric.name || label(metric.key),
    color: metric.color || CURVE_COLORS[index % CURVE_COLORS.length],
    values: points.map((row) => {
      const value = row[metric.key]
      if (value === null || value === undefined || value === '') return null
      const n = Number(value)
      return Number.isFinite(n) ? n : null
    }),
  })).filter((item) => item.values.some((value) => value !== null))
  if (!series.length) return null
  return {
    labels: points.map((row) => shortTime(row[labelKey])),
    axis: axis || familyOf((metrics[0] && metrics[0].key) || ''),
    series,
  }
}

function pickMetric(keys) {
  const prefer = ['active_users', 'dau', 'ad_revenue_estimated_cny', 'revenue', 'share_count', 'user_cnt', 'new_users', 'total']
  return prefer.find((key) => keys.includes(key)) || keys[0]
}

function samplePoints(rows, max) {
  if (rows.length <= max) return rows
  const out = []
  const step = (rows.length - 1) / (max - 1)
  for (let i = 0; i < max; i += 1) out.push(rows[Math.round(i * step)])
  return out
}

function barsFrom(rows, labelKey, valueKey, textKey) {
  const points = samplePoints(rows || [], 16)
  const max = Math.max(...points.map((row) => Number(row[valueKey]) || 0), 1)
  return points.map((row) => ({
    label: shortTime(row[labelKey]),
    pct: Math.round(((Number(row[valueKey]) || 0) / max) * 100),
    text: formatValue(textKey || valueKey, row[valueKey]),
  }))
}

function tableFrom(rows, columns) {
  return {
    columns: columns.map((col) => ({ key: col.key, label: col.label || label(col.key) })),
    rows: (rows || []).map((row) => columns.map((col) => (
      col.format ? col.format(row) : formatValue(col.key, row[col.key])
    ))),
  }
}

function arraySection(key, rows) {
  if (!rows.length) return blank(label(key), { notice: '暂无数据' })
  if (isScalar(rows[0])) {
    return blank(label(key), { lines: rows.slice(0, 12).map((item) => formatValue(key, item)) })
  }
  const sample = rows[0]
  const keys = Object.keys(sample).filter((item) => !HIDDEN.has(item) && isScalar(sample[item]))
  const timeKey = keys.find((item) => /date|_at$|bucket|minute|hour/.test(item))
  const numKeys = keys.filter((item) => typeof sample[item] === 'number')
  if (timeKey && numKeys.length && rows.length >= 2) {
    const lead = pickMetric(numKeys)
    const axis = familyOf(lead)
    const picked = [lead].concat(numKeys.filter((item) => item !== lead && familyOf(item) === axis)).slice(0, 4)
    const chart = chartFrom(rows, timeKey, picked.map((item) => ({ key: item })), axis)
    if (chart) return blank(label(key), { chart })
  }
  const nameKey = keys.find((item) => typeof sample[item] === 'string')
  if (nameKey && numKeys.length) {
    const metric = pickMetric(numKeys)
    const max = Math.max(...rows.map((row) => Number(row[metric]) || 0), 1)
    return blank(label(key), {
      bars: rows.slice(0, 8).map((row) => ({
        label: phrase(row[nameKey]).slice(0, 12),
        pct: Math.round(((Number(row[metric]) || 0) / max) * 100),
        text: formatValue(metric, row[metric]),
      })),
    })
  }
  return blank(label(key), {
    lines: rows.slice(0, 8).map((row) => keys.slice(0, 3).map((item) => `${label(item)} ${formatValue(item, row[item])}`).join(' · ')),
  })
}

function isFlat(value) {
  return Object.keys(value).every((key) => isScalar(value[key]) || (Array.isArray(value[key]) && value[key].every(isScalar)))
}

function present(title, data, depth) {
  const level = depth || 0
  if (!data || typeof data !== 'object') return [blank(title, { notice: '暂无数据' })]
  if (data.ok === false) return [blank(title, { error: data.error || data.code || '加载失败' })]
  const sections = []
  const kpis = []
  const lines = []
  const seriesKeep = ['series_daily', 'series_hourly', 'series'].find((key) => Array.isArray(data[key]) && data[key].length)
  Object.keys(data).forEach((key) => {
    if (HIDDEN.has(key) || key === 'notice') return
    if (['series', 'series_hourly', 'series_daily'].includes(key) && key !== seriesKeep) return
    const value = data[key]
    if (value === undefined) return
    if (isScalar(value)) {
      if (typeof value === 'string' && value.length > 36) lines.push(phrase(value))
      else kpis.push({ label: label(key), value: formatValue(key, value), sub: '', subColor: '' })
      return
    }
    if (Array.isArray(value)) {
      if (level < 3) sections.push(arraySection(key, value))
      return
    }
    if (value && typeof value === 'object') {
      if (isFlat(value)) {
        const flatKpis = []
        const flatLines = []
        Object.keys(value).forEach((child) => {
          if (Array.isArray(value[child])) flatLines.push(...value[child].slice(0, 8).map((item) => phrase(item)))
          else if (isScalar(value[child])) flatKpis.push({ label: label(child), value: formatValue(child, value[child]), sub: '', subColor: '' })
        })
        sections.push(blank(label(key), { kpis: flatKpis, lines: flatLines }))
      } else if (level < 3) {
        sections.push(...present(label(key), Object.assign({ ok: true }, value), level + 1))
      }
    }
  })
  if (kpis.length || lines.length || data.notice) {
    sections.unshift(blank(title, { notice: data.notice ? phrase(data.notice) : '', kpis, lines }))
  }
  return sections.length ? sections : [blank(title, { notice: data.notice || '暂无数据' })]
}

module.exports = {
  label,
  phrase,
  formatValue,
  shortTime,
  blank,
  barsFrom,
  tableFrom,
  chartFrom,
  present,
}
