import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/About.vue')
  },
  {
    path: '/minesweeper',
    name: 'minesweeper',
    component: () => import('../views/Minesweeper.vue')
  },
  {
    path: '/messages',
    name: 'messages',
    component: () => import('../views/Messages.vue')
  }
]

export const router = createRouter({
  history: createWebHashHistory(), // 使用 hash 路由，避免 GitHub Pages 刷新 404 问题
  routes
})

export default router
