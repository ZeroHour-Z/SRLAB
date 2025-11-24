import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
// GitHub Pages 部署配置
// 如果仓库名是 'srlab'，访问地址会是 https://<username>.github.io/srlab/
// 可以通过环境变量 VITE_REPO_NAME 设置，或手动修改 base
const repoName = process.env.VITE_REPO_NAME || 'SRLAB';
const base = process.env.NODE_ENV === 'production' 
  ? `/${repoName}/`  // 生产环境使用绝对路径
  : './';  // 开发环境使用相对路径

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});