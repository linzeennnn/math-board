import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4321,      // 指定端口
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5678",
        changeOrigin: true
      },

      "/ws": {
        target: "http://127.0.0.1:5678",
        ws: true,
        changeOrigin: true
      }
    }
  },
  resolve: {
  alias: {
    '@': path.resolve(__dirname, 'src')
  }
}
})
