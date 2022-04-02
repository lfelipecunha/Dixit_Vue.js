import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { VuesticPlugin } from 'vuestic-ui'
import 'vuestic-ui/dist/styles/essential.css'
import 'vuestic-ui/dist/styles/grid/grid.scss'
import 'vuestic-ui/dist/styles/global/normalize.scss'
import 'vuestic-ui/dist/styles/global/typography.scss'
import VueSocketIO from 'vue-3-socket.io'
import VueCookies from 'vue3-cookies'
import store from './store'


const vSIO = new VueSocketIO({
  debug: true,
  connection: ':8081',
  vuex: {
    store,
    actionPrefix: 'socket',
    mutationPrefix: 'socket'
  }
})

createApp(App).use(store).use(router).use(VuesticPlugin).use(vSIO).use(VueCookies).mount('#app')
