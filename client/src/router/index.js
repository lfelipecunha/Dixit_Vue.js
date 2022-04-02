import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { useCookies } from "vue3-cookies";

const { cookies } = useCookies();
const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/player-hand',
    name: 'player-hand',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/PlayerHandView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

router.beforeEach((to, from, next) => {
  if (to.name == 'home' && cookies.get('dixit_game_socket_id') != null) {
    next('player-hand');
    return;
  }
  next();
})

export default router
