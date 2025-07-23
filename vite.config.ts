import react from "@vitejs/plugin-react";
import {defineConfig} from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // UI Framework
          'ui-framework': ['@heroui/react', '@heroui/use-theme'],

          // Animation libraries
          'animations': ['framer-motion'],

          // Icons and graphics
          'icons': ['@iconify/react'],

          // Charts and analytics
          'charts': ['recharts', '@nivo/bar', '@nivo/pie'],

          // Data processing utilities
          'data-utils': ['papaparse', 'xlsx', 'date-fns'],

          // Virtual scrolling
          'virtualization': ['@tanstack/react-virtual'],

          // Database and storage
          'database': ['@supabase/supabase-js'],

          // Analytics and monitoring
          'analytics': ['@vercel/analytics']
        }
      }
    },
    // Enable source maps for better debugging
    sourcemap: true,

    // Optimize chunk size warnings
    chunkSizeWarningLimit: 1000,

    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs in production
        drop_debugger: true
      }
    }
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@heroui/react',
      'framer-motion',
      '@iconify/react',
      'papaparse',
      'date-fns'
    ]
  }
});
