import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const isMobile = ref(window.innerWidth < 768)
  const isTablet = ref(window.innerWidth >= 768 && window.innerWidth < 1200)
  const sidebarCollapsed = ref(false)

  function updateBreakpoint() {
    isMobile.value = window.innerWidth < 768
    isTablet.value = window.innerWidth >= 768 && window.innerWidth < 1200
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateBreakpoint)
  }

  return { isMobile, isTablet, sidebarCollapsed }
})
