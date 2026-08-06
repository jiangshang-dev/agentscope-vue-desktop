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

      <a-form layout="vertical" @finish="onSubmit">
        <a-form-item label="API 地址">
          <a-input v-model:value="apiBase" :placeholder="envApiBase" />
        </a-form-item>
        <a-form-item label="用户名" name="username" :rules="[{ required: true, message: '请输入用户名' }]">
          <a-input v-model:value="username" autocomplete="username" />
        </a-form-item>
        <a-form-item label="密码" name="password" :rules="[{ required: true, message: '请输入密码' }]">
          <a-input-password v-model:value="password" autocomplete="current-password" />
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
 * 登录/注册页：配置 API 地址、检测健康、写入 auth store 后跳转 ChatView。
 * 与 router（public 路由）、stores/auth、api/client 的 baseURL/token 持久化协作。
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useAuthStore } from '../stores/auth'
import { getEnvApiBase } from '../api/client'

const auth = useAuthStore()
const router = useRouter()
const envApiBase = getEnvApiBase()
const apiBase = ref(auth.apiBase || envApiBase)
const username = ref('desktop')
const password = ref('desktop123')

async function onHealth(): Promise<void> {
  // 仅探测连通性，不登录；结果展示在卡片底部 health tags
  auth.updateApiBase(apiBase.value)
  const ok = await auth.checkHealth()
  message[ok ? 'success' : 'error'](ok ? 'API 已连接' : auth.error || '连接失败')
}

async function onSubmit(): Promise<void> {
  auth.updateApiBase(apiBase.value)
  await auth.login(username.value.trim(), password.value)
  message.success('登录成功')
  router.replace({ name: 'chat' })
}

async function onRegister(): Promise<void> {
  auth.updateApiBase(apiBase.value)
  await auth.register(username.value.trim(), password.value, username.value.trim())
  message.success('注册成功')
  router.replace({ name: 'chat' })
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
