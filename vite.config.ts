import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import projectsPlugin from './vite-plugin-projects'
import monitorPlugin from './vite-plugin-monitor'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), projectsPlugin(), monitorPlugin()],
  server: {
    host: 'localhost',
    port: 3849,
    open: true,
    // For a prettier hostname, add to /etc/hosts:
    //   127.0.0.1  openclaw.local
    // Then change host to 'openclaw.local' and visit http://openclaw.local:3000
  },
})
