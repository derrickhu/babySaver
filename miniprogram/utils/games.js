const GAMES = [
  { gameKey: 'hotpot', displayName: '别捞水果', panels: ['level_progress', 'hotpot_fruit_slice', 'hotpot_daily_limited'] },
  { gameKey: 'huahua', displayName: '花花妙屋', panels: ['huahua_growth', 'huahua_order_funnel', 'huahua_engagement', 'huahua_economy_flow'] },
  { gameKey: 'caizhu', displayName: '彩珠五连', panels: ['level_progress', 'caizhu_gameplay'] },
  { gameKey: 'petTower', displayName: '灵宠消消塔', panels: ['pet_tower_gameplay', 'level_progress'] },
  { gameKey: 'wujin_wenzhang', displayName: '无尽纹章', panels: ['wujin_gameplay', 'level_progress'] },
  { gameKey: 'cunkou', displayName: '村口大战外星人', panels: ['level_progress'] },
  { gameKey: 'jiancai', displayName: '扫荡菜场', panels: ['jiancai_gameplay'] },
  { gameKey: 'blackrosa', displayName: '墨字防线', panels: ['level_progress'] },
]

const SNAPSHOT_GAMES = ['huahua', 'hotpot', 'petTower']

const PANELS = {
  level_progress: { title: '关卡通关漏斗', path: '/api/realtime/level-progress' },
  hotpot_fruit_slice: { title: '果切挑战', path: '/api/realtime/hotpot-fruit-slice' },
  hotpot_daily_limited: { title: '每日限定', path: '/api/realtime/hotpot-daily-limited' },
  huahua_economy_flow: { title: '经济流转', path: '/api/realtime/huahua-economy' },
  huahua_order_funnel: { title: '订单漏斗', path: '/api/realtime/huahua-order' },
  huahua_growth: { title: '新手引导', path: '/api/realtime/huahua-growth' },
  huahua_engagement: { title: '参与度', path: '/api/realtime/huahua-engagement' },
  caizhu_gameplay: { title: '彩珠玩法', path: '/api/realtime/caizhu-gameplay' },
  pet_tower_gameplay: { title: '灵宠消消塔', path: '/api/realtime/pet-tower-gameplay' },
  jiancai_gameplay: { title: '扫荡菜场', path: '/api/realtime/jiancai-gameplay' },
  wujin_gameplay: { title: '无尽纹章', path: '/api/realtime/wujin-gameplay' },
}

const PLATFORMS = [
  { key: 'wechat', label: '微信' },
  { key: 'douyin', label: '抖音' },
  { key: 'taptap', label: '塔普' },
  { key: 'huawei', label: '华为' },
]

function findGame(gameKey) {
  return GAMES.find((item) => item.gameKey === gameKey) || GAMES[0]
}

module.exports = {
  GAMES,
  SNAPSHOT_GAMES,
  PANELS,
  PLATFORMS,
  findGame,
}
