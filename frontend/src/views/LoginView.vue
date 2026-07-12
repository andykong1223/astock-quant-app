<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NForm,
  NFormItem,
  NInput,
  NButton,
  NCard,
  useMessage,
} from 'naive-ui'
import { useUserStore } from '@/stores/user'

const user = useUserStore()
const router = useRouter()
const message = useMessage()
const email = ref('demo@astock.com')
const password = ref('demo123456')

async function submit() {
  try {
    await user.login(email.value, password.value)
    message.success('登录成功')
    const redirect = (router.currentRoute.value.query.redirect as string) || '/'
    router.replace(redirect)
  } catch (e) {
    message.error((e as Error).message)
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-bg" />
    <NCard class="auth-card fade-up">
      <div class="logo">
        <div class="mark" />
        <div>
          <h1>AStock Quant</h1>
          <p>登录你的量化工作台</p>
        </div>
      </div>
      <NForm @submit.prevent="submit">
        <NFormItem label="邮箱">
          <NInput v-model:value="email" type="text" placeholder="email" size="large" />
        </NFormItem>
        <NFormItem label="密码">
          <NInput v-model:value="password" type="password" show-password-on="click" size="large" />
        </NFormItem>
        <NButton type="primary" block size="large" :loading="user.loading" attr-type="submit">
          登录
        </NButton>
      </NForm>
      <div class="footer">
        <span>演示账号已预填</span>
        <RouterLink to="/register">注册账号</RouterLink>
      </div>
    </NCard>
  </div>
</template>

<style scoped lang="scss">
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
  overflow: hidden;
}
.auth-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 50% at 50% 0%, rgba(45, 212, 168, 0.18), transparent 60%),
    radial-gradient(ellipse 50% 40% at 80% 80%, rgba(245, 165, 36, 0.1), transparent 50%),
    linear-gradient(180deg, #070b14, #0b1220);
}
.auth-card {
  width: 100%;
  max-width: 400px;
  position: relative;
  z-index: 1;
  background: rgba(18, 26, 43, 0.9) !important;
  backdrop-filter: blur(16px);
}
.logo {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-bottom: 28px;
  h1 {
    font-size: 22px;
    font-weight: 700;
  }
  p {
    color: var(--text-secondary);
    font-size: 13px;
    margin-top: 2px;
  }
}
.mark {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(160deg, #2dd4a8, #0d9488);
  box-shadow: 0 0 28px rgba(45, 212, 168, 0.4);
}
.footer {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  font-size: 13px;
  color: var(--text-muted);
  a {
    color: var(--accent);
  }
}
</style>
