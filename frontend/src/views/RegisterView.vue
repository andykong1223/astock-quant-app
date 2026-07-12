<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NForm, NFormItem, NInput, NButton, NCard, useMessage } from 'naive-ui'
import { useUserStore } from '@/stores/user'

const user = useUserStore()
const router = useRouter()
const message = useMessage()
const email = ref('')
const password = ref('')
const username = ref('')

async function submit() {
  try {
    await user.register(email.value, password.value, username.value || undefined)
    message.success('注册成功')
    router.replace('/')
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
          <h1>创建账号</h1>
          <p>开始管理你的自选与策略</p>
        </div>
      </div>
      <NForm @submit.prevent="submit">
        <NFormItem label="昵称">
          <NInput v-model:value="username" size="large" placeholder="可选" />
        </NFormItem>
        <NFormItem label="邮箱">
          <NInput v-model:value="email" size="large" />
        </NFormItem>
        <NFormItem label="密码">
          <NInput v-model:value="password" type="password" show-password-on="click" size="large" placeholder="至少6位" />
        </NFormItem>
        <NButton type="primary" block size="large" :loading="user.loading" attr-type="submit">
          注册
        </NButton>
      </NForm>
      <div class="footer">
        <RouterLink to="/login">已有账号？登录</RouterLink>
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
}
.auth-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 50% at 30% 0%, rgba(45, 212, 168, 0.15), transparent 60%),
    linear-gradient(180deg, #070b14, #0b1220);
}
.auth-card {
  width: 100%;
  max-width: 400px;
  position: relative;
  z-index: 1;
  background: rgba(18, 26, 43, 0.9) !important;
}
.logo {
  display: flex;
  gap: 14px;
  margin-bottom: 24px;
  h1 { font-size: 22px; font-weight: 700; }
  p { color: var(--text-secondary); font-size: 13px; }
}
.mark {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(160deg, #2dd4a8, #0d9488);
}
.footer {
  margin-top: 16px;
  text-align: center;
  a { color: var(--accent); font-size: 13px; }
}
</style>
