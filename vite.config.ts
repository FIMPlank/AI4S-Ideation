/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base: works on GitHub Pages under /<repo>/ and locally, because routing is hash-based.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    // unit tests cover pure logic (data, search, draw, routing), so no DOM needed
    environment: 'node',
  },
})
