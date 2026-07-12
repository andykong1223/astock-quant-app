<script setup lang="ts">
import { NButton, NResult } from 'naive-ui'
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="page" style="display:flex;align-items:center;justify-content:center;min-height:60vh">
    <NResult status="404" title="页面不存在" description="换个地址试试">
      <template #footer>
        <NButton type="primary" @click="router.push('/')">回首页</NButton>
      </template>
    </NResult>
  </div>
</template>
