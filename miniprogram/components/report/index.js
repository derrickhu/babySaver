Component({
  properties: {
    loading: { type: Boolean, value: false },
    refreshing: { type: Boolean, value: false },
    error: { type: String, value: '' },
    sections: { type: Array, value: [] },
  },
  data: { openKey: '' },
  methods: {
    onCard(event) {
      this.triggerEvent('card', { id: event.currentTarget.dataset.id })
    },
    onSheetRow(event) {
      const key = `${event.currentTarget.dataset.section}:${event.currentTarget.dataset.row}`
      this.setData({ openKey: this.data.openKey === key ? '' : key })
    },
  },
})
