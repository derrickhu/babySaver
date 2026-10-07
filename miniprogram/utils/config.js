/** 经分云托管。数据在 rosa 环境的 game-analysis 服务里。 */
module.exports = {
  env: 'rosa-env-d7grf78r5dbd37323',
  service: 'game-analysis',
  publicBase: 'https://www.luckygua.cn/game-analysis',
  // 服务端优先认镜像里的 GA_BASIC_AUTH_PASSWORD，控制台的 GA_ACCESS_PASSWORD 不会生效。不在页面上询问。
  accessPassword: 'sss198821',
}
