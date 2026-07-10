import { createRouter, createWebHistory } from 'vue-router'
import GameView from './views/GameView.vue'
import CalendarView from './views/CalendarView.vue'

const routes = [
  { path: '/', component: GameView },
  { path: '/calendar', component: CalendarView },
  { path: '/play/:date', component: GameView },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
