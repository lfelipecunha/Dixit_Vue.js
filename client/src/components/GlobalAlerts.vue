<template>
  <div>
    <va-alert v-for="(alert, index) in alerts" :color="alert.type" :key="`alert-${index}`" closeable @click="removeAlert(index)">
      {{alert.message}}
    </va-alert>
  </div>
</template>
<script>
import { mapState } from 'vuex'
export default {
  name: 'GlobalAlerts',
  computed: mapState(['alerts']),
  methods: {
    removeAlert: function(index) {
      this.$store.dispatch('removeAlert', index)
    },
  }
}
</script>
