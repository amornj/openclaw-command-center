import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 3000,
    open: true,
    // For a prettier hostname, add to /etc/hosts:
    //   127.0.0.1  openclaw.local
    // Then change host to 'openclaw.local' and visit http://openclaw.local:3000
  },
})
