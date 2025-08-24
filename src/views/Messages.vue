<template>
  <section class="page">
    <h2>留言</h2>
    <p>欢迎在此留言与反馈（依托 GitHub Issues）。</p>
    <div ref="comments"></div>
    <div class="back">
      <RouterLink to="/">返回首页 ←</RouterLink>
    </div>
  </section>
  
</template>

<script setup>
import { ref, onMounted } from 'vue'

const comments = ref(null)

onMounted(() => {
  // 动态注入 utterances 脚本，使用 URL 作为 issue 绑定，兼容 hash 路由
  const script = document.createElement('script')
  script.src = 'https://utteranc.es/client.js'
  script.async = true
  script.crossOrigin = 'anonymous'
  // 将 repo 替换为你的仓库 "owner/repo"，这里默认当前项目
  script.setAttribute('repo', 'Bifreedom/bbb')
  // 使用完整 URL（包含 #/ 路由）作为 issue-term，适配 GitHub Pages 的 hash 路由
  script.setAttribute('issue-term', 'url')
  script.setAttribute('label', 'comments')
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  script.setAttribute('theme', prefersDark ? 'github-dark' : 'github-light')
  comments.value && comments.value.appendChild(script)
})
</script>

<style scoped>
.page { padding: 24px; max-width: 860px; margin: 0 auto; text-align: left; }
.back { margin-top: 16px; }
</style>
