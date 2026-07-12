<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard,
  NButton,
  NAvatar,
  NInput,
  NForm,
  NFormItem,
  NDivider,
  useMessage,
} from 'naive-ui'
import { useUserStore } from '@/stores/user'
import { authApi } from '@/api'

const user = useUserStore()
const router = useRouter()
const message = useMessage()
const username = ref(user.user?.username || '')
const resetEmail = ref(user.user?.email || '')

async function saveProfile() {
  try {
    const u = await authApi.updateProfile({ username: username.value })
    user.user = u
    sessionStorage.setItem('astock_user', JSON.stringify(u))
    message.success('资料已更新')
  } catch (e) {
    message.error((e as Error).message)
  }
}

async function resetPwd() {
  try {
    await authApi.resetPassword(resetEmail.value)
    message.success('重置邮件已发送（演示模式为模拟）')
  } catch (e) {
    message.error((e as Error).message)
  }
}

async function logout() {
  await user.logout()
  message.success('已登出')
  router.push('/login')
}
</script>

<template>
  <div class="page">
    <h1 class="title">我的</h1>

    <NCard v-if="user.isLoggedIn" class="profile fade-up">
      <div class="user-row">
        <NAvatar round size="large" :style="{ background: '#2dd4a8', color: '#0b1220' }">
          {{ (user.user?.username || 'U')[0] }}
        </NAvatar>
        <div>
          <div class="uname">{{ user.user?.username }}</div>
          <div class="email">{{ user.user?.email }}</div>
        </div>
      </div>
      <NDivider />
      <NForm>
        <NFormItem label="昵称">
          <NInput v-model:value="username" />
        </NFormItem>
        <NButton type="primary" @click="saveProfile">保存资料</NButton>
      </NForm>
      <NDivider />
      <NForm>
        <NFormItem label="密码重置邮箱">
          <NInput v-model:value="resetEmail" />
        </NFormItem>
        <NButton @click="resetPwd">发送重置邮件</NButton>
      </NForm>
      <NDivider />
      <NButton block type="error" secondary @click="logout">退出登录</NButton>
    </NCard>

    <NCard v-else class="profile fade-up">
      <p class="guest">登录后可保存自选股、策略与回测记录</p>
      <NButton type="primary" block size="large" @click="router.push('/login')">登录 / 注册</NButton>
    </NCard>

    <div class="about fade-up">
      <h3>AStock Quant</h3>
      <p>A股量化分析平台 · Demo Mode</p>
      <p class="ver">v1.0.0 · Vue3 + Express + Supabase</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.title { font-size: 24px; font-weight: 700; margin-bottom: 16px; }
.profile { background: rgba(18, 26, 43, 0.85) !important; }
.user-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.uname { font-weight: 700; font-size: 18px; }
.email { color: var(--text-secondary); font-size: 13px; }
.guest { color: var(--text-secondary); margin-bottom: 16px; }
.about {
  margin-top: 32px;
  text-align: center;
  color: var(--text-muted);
  h3 { color: var(--text-primary); margin-bottom: 6px; }
  .ver { font-size: 12px; margin-top: 8px; }
}
</style>
