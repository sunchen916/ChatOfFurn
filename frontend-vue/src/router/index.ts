import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'
import AuthPage from '../views/AuthPage.vue'
import CarMatchPage from '../views/CarMatchPage.vue'
import { useAuthStore } from '../stores/auth'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage, meta: { requiresAuth: true } },
    { path: '/car-match', name: 'carMatch', component: CarMatchPage, meta: { requiresAuth: true } },
    { path: '/auth', name: 'auth', component: AuthPage, meta: { requiresAuth: false } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.user === null) {
    // silent check; 401 is expected when not logged in
    await auth.fetchMe()
  }

  const requiresAuth = to.meta.requiresAuth === true
  if (requiresAuth && !auth.isAuthed) return { path: '/auth', query: { next: to.fullPath } }
  if (to.path === '/auth' && auth.isAuthed) return { path: '/' }
  return true
})

