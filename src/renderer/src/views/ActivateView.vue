<template>
  <div class="activate-page">
    <a-card class="activate-card" :bordered="false">
      <div class="brand">
        <div class="logo">A</div>
        <div>
          <h1>软件激活</h1>
          <p>输入激活密钥后方可使用对话功能</p>
        </div>
      </div>

      <a-alert
        type="info"
        show-icon
        style="margin-bottom: 16px"
        message="密钥由发行方签发，格式以 AGOS. 开头。激活后绑定本机。"
      />

      <!-- Ant Design Form 必须用 :model 绑定字段；仅 v-model 到独立 ref 时校验会认为未填 -->
      <a-form layout="vertical" :model="form" @finish="onSubmit">
        <a-form-item
          label="激活密钥"
          name="key"
          :rules="[{ required: true, whitespace: true, message: '请输入激活密钥' }]"
        >
          <a-textarea
            v-model:value="form.key"
            :rows="4"
            placeholder="AGOS.xxxx.yyyy"
            spellcheck="false"
            @pressEnter.ctrl="onSubmit"
          />
        </a-form-item>

        <a-alert
          v-if="submitError"
          type="error"
          show-icon
          :message="submitError"
          style="margin-bottom: 12px"
        />

        <a-space direction="vertical" style="width: 100%">
          <a-button type="primary" html-type="submit" block size="large" :loading="license.loading">
            激活并继续
          </a-button>
          <a-button block @click="goLogin">返回登录</a-button>
        </a-space>
      </a-form>

      <div class="meta" v-if="license.status.machineId">
        <span>设备指纹：{{ license.status.machineId }}</span>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
/**
 * 激活页：校验密钥后进入登录或对话。
 * 与 stores/license、router 守卫协作。
 */
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useAuthStore } from '../stores/auth'
import { useLicenseStore } from '../stores/license'

const license = useLicenseStore()
const auth = useAuthStore()
const router = useRouter()
const form = reactive({ key: '' })
const submitError = ref('')

onMounted(() => {
  void license.refresh()
})

async function onSubmit(): Promise<void> {
  submitError.value = ''
  const raw = form.key.trim()
  if (!raw) {
    submitError.value = '请输入激活密钥'
    return
  }
  const res = await license.activate(raw)
  if (!res.activated) {
    submitError.value = res.message || '激活失败'
    message.error(submitError.value)
    return
  }
  message.success(`激活成功（${res.plan || 'standard'}，有效期 ${res.expLabel}）`)
  router.replace({ name: auth.isAuthed ? 'chat' : 'login' })
}

function goLogin(): void {
  router.replace({ name: 'login' })
}
</script>

<style scoped>
.activate-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(1200px 600px at 10% -10%, rgba(47, 143, 110, 0.18), transparent 55%),
    radial-gradient(900px 500px at 100% 0%, rgba(64, 100, 180, 0.12), transparent 50%),
    #0e1116;
}
.activate-card {
  width: min(440px, 100%);
  background: #151a22 !important;
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
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 22px;
  color: #fff;
  background: linear-gradient(145deg, #2f8f6e, #1f6b52);
}
.brand h1 {
  margin: 0;
  font-size: 22px;
  color: #e8edf5;
}
.brand p {
  margin: 4px 0 0;
  color: #8b95a8;
  font-size: 13px;
}
.meta {
  margin-top: 16px;
  font-size: 12px;
  color: #6b7585;
  word-break: break-all;
}
</style>
