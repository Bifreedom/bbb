import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 说明：
// - 线上部署到二级路径（如 GitHub Pages: /<repo>/）时，构建产物若使用根路径 /assets/** 会 404。
// - 本配置默认使用相对路径 './'，确保任意子路径都能正确加载资源。
// - 在 GitHub Actions 中仍自动根据仓库名设置 '/<repo>/'，也可用环境变量 BASE 覆盖。
export default defineConfig(() => {
  const isCI = !!process.env.GITHUB_ACTIONS
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
  // 优先显式 BASE，其次 CI 场景下用 '/<repo>/'，否则本地构建用相对路径 './'
  const base = process.env.BASE ?? (isCI && repo ? `/${repo}/` : './')

  return {
    plugins: [vue()],
    base,
  }
})
