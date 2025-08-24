import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 如果部署到 GitHub Pages，仓库名为 /bbb/，需设置 base
const base = process.env.GITHUB_ACTIONS ? '/bbb/' : '/'

export default defineConfig({
  plugins: [vue()],
  base
})
