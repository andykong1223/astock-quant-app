<script setup lang="ts">
import { computed } from 'vue'
import { NEmpty, NSpin, NTag } from 'naive-ui'
import type { StockNewsItem } from '@/types'

const props = defineProps<{
  items: StockNewsItem[]
  loading?: boolean
}>()

const news = computed(() => props.items.filter((x) => x.type === 'news'))
const announcements = computed(() => props.items.filter((x) => x.type === 'announcement'))

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(+d)) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function open(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="news-panel fade-up">
    <div v-if="loading && !items.length" class="loading-box">
      <NSpin size="small" />
      <span>加载相关资讯…</span>
    </div>

    <NEmpty v-else-if="!items.length" description="暂无相关新闻" />

    <template v-else>
      <section v-if="news.length" class="block">
        <h3 class="section-title">相关新闻</h3>
        <ul class="list">
          <li v-for="item in news" :key="item.id">
            <button type="button" class="row" @click="open(item.url)">
              <div class="top">
                <span class="title">{{ item.title }}</span>
                <NTag size="tiny" :bordered="false" type="info">新闻</NTag>
              </div>
              <p v-if="item.summary" class="summary">{{ item.summary }}</p>
              <div class="meta">
                <span>{{ item.source }}</span>
                <span class="mono">{{ formatTime(item.published_at) }}</span>
              </div>
            </button>
          </li>
        </ul>
      </section>

      <section v-if="announcements.length" class="block">
        <h3 class="section-title">公司公告</h3>
        <ul class="list">
          <li v-for="item in announcements" :key="item.id">
            <button type="button" class="row" @click="open(item.url)">
              <div class="top">
                <span class="title">{{ item.title }}</span>
                <NTag size="tiny" :bordered="false" type="warning">公告</NTag>
              </div>
              <div class="meta">
                <span>{{ item.source }}</span>
                <span class="mono">{{ formatTime(item.published_at) }}</span>
              </div>
            </button>
          </li>
        </ul>
      </section>

      <p class="hint">资讯来自东方财富，点击标题打开原文。</p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.loading-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 16px;
  color: var(--text-secondary);
  font-size: 13px;
}

.block {
  margin-bottom: 18px;
}

.section-title {
  font-size: 16px;
  margin: 0 0 10px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: rgba(18, 26, 43, 0.6);
}

.row {
  width: 100%;
  display: block;
  text-align: left;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: inherit;
  padding: 14px;
  cursor: pointer;

  &:hover {
    background: var(--bg-soft);
  }

  &:hover .title {
    color: var(--accent);
  }
}

li:last-child .row {
  border-bottom: none;
}

.top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  transition: color 0.15s;
}

.summary {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-muted);
}

.hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
