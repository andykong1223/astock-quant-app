<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NButton,
  NEmpty,
  NList,
  NListItem,
  NThing,
  NModal,
  NInput,
  NInputNumber,
  NForm,
  NFormItem,
  useMessage,
} from 'naive-ui'
import { strategiesApi } from '@/api'
import type { Strategy } from '@/types'

const message = useMessage()
const list = ref<Strategy[]>([])
const loading = ref(false)
const show = ref(false)
const name = ref('')
const shortP = ref(5)
const longP = ref(20)

async function load() {
  loading.value = true
  try {
    list.value = await strategiesApi.list()
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function create() {
  try {
    await strategiesApi.create(name.value, {
      type: 'dual_ma',
      shortPeriod: shortP.value,
      longPeriod: longP.value,
    })
    show.value = false
    name.value = ''
    message.success('策略已保存')
    await load()
  } catch (e) {
    message.error((e as Error).message)
  }
}

async function remove(id: string) {
  try {
    await strategiesApi.remove(id)
    message.success('已删除')
    await load()
  } catch (e) {
    message.error((e as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="head">
      <div>
        <h1>我的策略</h1>
        <p class="sub">保存双均线等策略配置，可在个股页运行回测</p>
      </div>
      <NButton type="primary" @click="show = true">新建策略</NButton>
    </div>

    <div class="panel">
      <NEmpty v-if="!loading && !list.length" description="暂无策略" />
      <NList v-else>
        <NListItem v-for="s in list" :key="s.id">
          <NThing :title="s.name" :description="JSON.stringify(s.config)">
            <template #header-extra>
              <NButton size="small" quaternary type="error" @click="remove(s.id)">删除</NButton>
            </template>
          </NThing>
        </NListItem>
      </NList>
    </div>

    <NModal v-model:show="show" preset="dialog" title="新建双均线策略" positive-text="保存" @positive-click="create">
      <NForm>
        <NFormItem label="名称">
          <NInput v-model:value="name" placeholder="例如：短线双均线" />
        </NFormItem>
        <NFormItem label="短期周期">
          <NInputNumber v-model:value="shortP" :min="2" :max="60" />
        </NFormItem>
        <NFormItem label="长期周期">
          <NInputNumber v-model:value="longP" :min="5" :max="250" />
        </NFormItem>
      </NForm>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  h1 { font-size: 24px; font-weight: 700; }
}
.sub { color: var(--text-secondary); font-size: 14px; margin-top: 4px; }
.panel {
  background: rgba(18, 26, 43, 0.7);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px;
}
</style>
