import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 5173 が使われているときに別のポートへずらさず、エラーで止める
    port: 5173,
    strictPort: true,
    // API はバックエンドに転送する（同じオリジンになるため CORS の設定が要らない）
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
})
