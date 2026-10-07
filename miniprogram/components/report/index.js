Component({
  properties: {
    loading: { type: Boolean, value: false },
    refreshing: { type: Boolean, value: false },
    error: { type: String, value: '' },
    sections: { type: Array, value: [] },
  },
  methods: {
    onCard(event) {
      this.triggerEvent('card', { id: event.currentTarget.dataset.id })
    },
  },
})
