import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        popup: resolve(__dirname, 'popup.html')
      }
    }
  },
  server: {
    host: true, // LAN経由アクセス許可
    port: 50001, // 任意（Viteのポート）
    proxy: {
      '/api': {
        target: 'http://172.16.1.135:50000', // ← バックエンドのURL
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
