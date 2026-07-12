import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: '自选', tab: 'home' },
        },
        {
          path: 'watchlist',
          name: 'watchlist',
          component: () => import('@/views/WatchlistView.vue'),
          meta: { title: '自选管理', tab: 'home', auth: true },
        },
        {
          path: 'screener',
          name: 'screener',
          component: () => import('@/views/ScreenerView.vue'),
          meta: { title: '选股', tab: 'screener' },
        },
        {
          path: 'fund-flow',
          name: 'fund-flow',
          component: () => import('@/views/FundFlowView.vue'),
          meta: { title: '板块资金', tab: 'fund-flow' },
        },
        {
          path: 'strategies',
          name: 'strategies',
          component: () => import('@/views/StrategiesView.vue'),
          meta: { title: '策略', tab: 'strategies', auth: true },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
          meta: { title: '我的', tab: 'settings' },
        },
        {
          path: 'stock/:code',
          name: 'stock',
          component: () => import('@/views/StockDetailView.vue'),
          meta: { title: '个股详情', hideTab: true },
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: '登录', guest: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { title: '注册', guest: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  document.title = `${to.meta.title || 'AStock Quant'} · A股量化`
  const token = sessionStorage.getItem('astock_token')
  if (to.meta.auth && !token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guest && token) {
    return { name: 'home' }
  }
})

export default router
