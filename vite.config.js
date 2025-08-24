import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 在 GitHub Actions 中自动读取仓库名作为 base，避免硬编码
const isCI = !!process.env.GITHUB_ACTIONS
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] // owner/repo -> repo
const base = isCI && repo ? `/${repo}/` : '/'

export default defineConfig({
  plugins: [vue()],
  base
})
