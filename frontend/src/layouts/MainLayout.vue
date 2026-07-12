<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import {
  StatsChartOutline,
  SearchOutline,
  PulseOutline,
  PersonOutline,
} from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const tabs = [
  { key: 'home', label: '自选', path: '/', icon: StatsChartOutline },
  { key: 'screener', label: '选股', path: '/screener', icon: SearchOutline },
  { key: 'strategies', label: '策略', path: '/strategies', icon: PulseOutline },
  { key: 'settings', label: '我的', path: '/settings', icon: PersonOutline },
]

const activeTab = computed(() => (route.meta.tab as string) || '')
const hideTab = computed(() => !!route.meta.hideTab)

function go(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="shell" :class="{ mobile: app.isMobile, desktop: !app.isMobile }">
    <aside v-if="!app.isMobile" class="sidebar">
      <div class="brand" @click="go('/')">
        <div class="brand-mark" />
        <div>
          <div class="brand-name">AStock</div>
          <div class="brand-sub">Quant</div>
        </div>
      </div>
      <nav class="side-nav">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="side-item"
          :class="{ active: activeTab === t.key }"
          @click="go(t.path)"
        >
          <NIcon :component="t.icon" :size="20" />
          <span>{{ t.label }}</span>
        </button>
      </nav>
      <div class="side-foot">A股量化分析平台</div>
    </aside>

    <div class="main-wrap">
      <header v-if="app.isMobile && !hideTab" class="topbar">
        <div class="brand-inline">
          <div class="brand-mark sm" />
          <span>AStock Quant</span>
        </div>
      </header>

      <main class="content">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>

      <nav v-if="app.isMobile && !hideTab" class="tabbar">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="tab-item"
          :class="{ active: activeTab === t.key }"
          @click="go(t.path)"
        >
          <NIcon :component="t.icon" :size="22" />
          <span>{{ t.label }}</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped lang="scss">
.shell {
  min-height: 100%;
  display: flex;
  background:
    radial-gradient(ellipse 80% 50% at 10% -10%, rgba(45, 212, 168, 0.12), transparent 50%),
    radial-gradient(ellipse 60% 40% at 100% 0%, rgba(245, 165, 36, 0.08), transparent 45%),
    var(--bg-deep);
}

.sidebar {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: rgba(11, 18, 32, 0.85);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  position: sticky;
  top: 0;
  height: 100vh;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  margin-bottom: 36px;
  padding: 0 8px;
}

.brand-mark {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background:
    linear-gradient(135deg, transparent 40%, rgba(245, 165, 36, 0.9) 40% 55%, transparent 55%),
    linear-gradient(160deg, #2dd4a8, #0d9488);
  box-shadow: 0 0 24px rgba(45, 212, 168, 0.35);
  &.sm {
    width: 28px;
    height: 28px;
    border-radius: 8px;
  }
}

.brand-name {
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.brand-sub {
  font-size: 12px;
  color: var(--accent);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.side-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.side-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 0 14px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 15px;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-soft);
    color: var(--text-primary);
  }

  &.active {
    background: var(--accent-dim);
    color: var(--accent);
    font-weight: 600;
  }
}

.side-foot {
  font-size: 12px;
  color: var(--text-muted);
  padding: 12px 8px;
}

.main-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.topbar {
  height: var(--nav-height);
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(11, 18, 32, 0.9);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 20;
}

.brand-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 16px;
}

.content {
  flex: 1;
  min-height: 0;
}

.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(var(--tab-height) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  display: flex;
  background: rgba(11, 18, 32, 0.95);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(16px);
  z-index: 30;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  min-height: 44px;

  &.active {
    color: var(--accent);
  }
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
