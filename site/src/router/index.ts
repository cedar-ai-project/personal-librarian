import { createRouter, createWebHistory } from 'vue-router'
import BookshelfView from '../views/BookshelfView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'bookshelf', component: BookshelfView },
    { path: '/book/:title', name: 'book', component: () => import('../views/BookView.vue'), props: true },
    { path: '/profile', component: () => import('../views/ProfileView.vue') },
    { path: '/recommend', component: () => import('../views/RecommendView.vue') },
    { path: '/tree', component: () => import('../views/KnowledgeTreeView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    // Switching tabs on the same book keeps the reader where they are.
    if (to.name === 'book' && from.name === 'book' && to.params.title === from.params.title) return false
    return { top: 0 }
  },
})

export default router
