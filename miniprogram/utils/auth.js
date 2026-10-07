function selectTab(page, index) {
  try {
    const tab = typeof page.getTabBar === 'function' && page.getTabBar()
    if (tab) tab.setData({ selected: index })
  } catch (error) {
    // 自定义 tabBar 尚未挂载时忽略
  }
}

module.exports = { selectTab }
