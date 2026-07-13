<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NForm,
  NFormItem,
  NInput,
  NButton,
  NCard,
  NCheckbox,
  useMessage,
} from 'naive-ui'
import { useUserStore } from '@/stores/user'
import {
  loadSavedCredentials,
  saveCredentials,
  clearSavedCredentials,
} from '@/utils/authStorage'

const user = useUserStore()
const router = useRouter()
const message = useMessage()
const email = ref('')
const password = ref('')
const remember = ref(false)

onMounted(() => {
  const saved = loadSavedCredentials()
  if (saved) {
    email.value = saved.email
    password.value = saved.password
    remember.value = true
  }
})

async function submit() {
  try {
    await user.login(email.value, password.value)
    if (remember.value) {
      saveCredentials(email.value, password.value)
    } else {
      clearSavedCredentials()
    }
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
          <NInput
            v-model:value="email"
            type="text"
            placeholder="请输入邮箱"
            size="large"
            autocomplete="username"
          />
        </NFormItem>
        <NFormItem label="密码">
          <NInput
            v-model:value="password"
            type="password"
            show-password-on="click"
            size="large"
            placeholder="请输入密码"
            autocomplete="current-password"
          />
        </NFormItem>
        <div class="row">
          <NCheckbox v-model:checked="remember">记住密码</NCheckbox>
        </div>
        <NButton type="primary" block size="large" :loading="user.loading" attr-type="submit">
          登录
        </NButton>
      </NForm>
      <div class="footer">
        <span />
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
.row {
  margin: -4px 0 16px;
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
