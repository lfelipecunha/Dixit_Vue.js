<template>
  <div>
    abce
  <va-modal ref="tipModal" title="Tip" size="small" hide-default-actions stateful>
    <slot>
      <va-form ref="tipForm" @validation="tipValidation = $event">
        <va-input v-model="tip" :rules="[value => !!value || 'Define a tip!']"/>
      </va-form>
    </slot>
    <template #footer>
      <va-button @click="$refs.tipForm.validate() && $emit('tip', tip)">Send</va-button>
    </template>
  </va-modal>
  </div>
</template>
<script>
export default {
  name: 'PlayerTip',
  props: [],
  emits: ['tip'],
  data() {
    return {
      tip: null
    }
  },
  mounted() {
    console.log('PlayerTip Mounted')
    this.$refs.tipModal.toggle()
  }
}
</script>
