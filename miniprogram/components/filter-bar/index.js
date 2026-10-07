const { GAMES, PLATFORMS } = require('../../utils/games')
const { OPTIONS } = require('../../utils/window')
const filterStore = require('../../utils/filter')

Component({
  properties: {
    showPlatform: { type: Boolean, value: true },
    showWindow: { type: Boolean, value: true },
  },
  data: {
    games: GAMES,
    platforms: PLATFORMS,
    windows: OPTIONS,
    filter: { gameKey: 'hotpot', platform: 'wechat', windowKey: 'today' },
  },
  lifetimes: {
    attached() {
      this.sync()
    },
  },
  pageLifetimes: {
    show() {
      this.sync()
    },
  },
  methods: {
    sync() {
      this.setData({ filter: filterStore.read() })
    },
    pick(event) {
      const field = event.currentTarget.dataset.field
      const value = event.currentTarget.dataset.value
      const filter = filterStore.write({ [field]: value })
      this.setData({ filter })
      this.triggerEvent('change', filter)
    },
  },
})
