<template>
  <div class="login-page">
    <a-card class="login-card" :bordered="false">
      <div class="brand">
        <div class="logo">A</div>
        <div>
          <h1>AgentOS</h1>
          <p>Electron × Vue3 × AgentScope API</p>
        </div>
      </div>

      <!-- 必须 :model，否则 name+rules 校验读不到 v-model，点登录会「无反应」 -->
      <a-form layout="vertical" :model="form" @finish="onSubmit">
        <a-form-item label="API 地址">
          <a-input v-model:value="form.apiBase" :placeholder="envApiBase" />
        </a-form-item>
        <a-form-item
          label="用户名"
          name="username"
          :rules="[{ required: true, whitespace: true, message: '请输入用户名' }]"
        >
          <a-input v-model:value="form.username" autocomplete="username" />
        </a-form-item>
        <a-form-item
          label="密码"
          name="password"
          :rules="[{ required: true, message: '请输入密码' }]"
        >
          <a-input-password v-model:value="form.password" autocomplete="current-password" />
        </a-form-item>

        <a-alert
          v-if="auth.error"
          type="error"
          show-icon
          :message="auth.error"
          style="margin-bottom: 12px"
        />
        <a-space direction="vertical" style="width: 100%">
          <a-button type="primary" html-type="submit" block :loading="auth.loading" size="large">
            登录
          </a-button>
          <a-button block :loading="auth.loading" @click="onRegister">注册并登录</a-button>
          <a-button type="link" block @click="onHealth">检测 API 连接</a-button>
        </a-space>
      </a-form>

      <div class="health" v-if="auth.health">
        <a-tag color="success">{{ auth.health.agent_mode }}</a-tag>
        <a-tag>{{ auth.health.model_name }}</a-tag>
        <a-tag>{{ auth.health.vector_db_provider }}</a-tag>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
/**
 * 登录/注册页：配置 API 地址、检测健康、写入 auth store 后跳转。
 * 与 router、stores/auth、stores/license、api/client 协作。
 */
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useAuthStore } from '../stores/auth'
import { useLicenseStore } from '../stores/license'
import { getEnvApiBase } from '../api/client'

const auth = useAuthStore()
const license = useLicenseStore()
const router = useRouter()
const envApiBase = getEnvApiBase()

const form = reactive({
  apiBase: auth.apiBase || envApiBase,
  username: 'desktop',
  password: 'desktop123',
})

async function goAfterAuth(): Promise<void> {
  await license.refresh()
  router.replace({ name: license.isActivated ? 'chat' : 'activate' })
}

async function onHealth(): Promise<void> {
  auth.updateApiBase(form.apiBase)
  const ok = await auth.checkHealth()
  message[ok ? 'success' : 'error'](ok ? 'API 已连接' : auth.error || '连接失败')
}

async function onSubmit(): Promise<void> {
  try {
    auth.updateApiBase(form.apiBase)
    await auth.login(form.username.trim(), form.password)
    message.success('登录成功')
    await goAfterAuth()
  } catch {
    // auth.error 已写入 store，页面上会显示
  }
}

async function onRegister(): Promise<void> {
  try {
    auth.updateApiBase(form.apiBase)
    const name = form.username.trim()
    await auth.register(name, form.password, name)
    message.success('注册成功')
    await goAfterAuth()
  } catch {
    // auth.error 已写入 store
  }
}
</script>

<style scoped>
.login-page {
  height: 100%;
  display: grid;
  place-items: center;
  background:
    radial-gradient(1000px 500px at 20% -10%, #1a3a2e 0%, transparent 55%),
    radial-gradient(800px 400px at 100% 0%, #1a2436 0%, transparent 50%),
    #0e1116;
}
.login-card {
  width: 420px;
  background: #151a22 !important;
  border: 1px solid #243041 !important;
  border-radius: 18px !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}
.brand {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-bottom: 20px;
}
.logo {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #2f8f6e, #1f6b52);
  color: #fff;
  font-weight: 800;
  font-size: 22px;
}
.brand h1 {
  margin: 0;
  font-size: 24px;
}
.brand p {
  margin: 2px 0 0;
  color: #8b93a1;
  font-size: 12px;
}
.health {
  margin-top: 16px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
