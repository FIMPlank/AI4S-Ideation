/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { parseLeitfaden } from './src/content/parse.ts'

const LEITFADEN_ID = 'virtual:leitfaden'
const LEITFADEN_FILE = resolve('src/content/leitfaden.de.md')

/** Parses the brochure Markdown at build time; the browser only gets JSON. */
function leitfaden(): Plugin {
  return {
    name: 'leitfaden',
    resolveId: (id) => (id === LEITFADEN_ID ? '\0' + LEITFADEN_ID : undefined),
    load(id) {
      if (id !== '\0' + LEITFADEN_ID) return
      this.addWatchFile(LEITFADEN_FILE)
      const doc = parseLeitfaden(readFileSync(LEITFADEN_FILE, 'utf8'))
      return `export default ${JSON.stringify(doc)}`
    },
  }
}

// Relative base: works on GitHub Pages under /<repo>/ and locally, because routing is hash-based.
export default defineConfig({
  base: './',
  plugins: [react(), leitfaden()],
  test: {
    // unit tests cover pure logic (data, search, draw, routing, parsing), so no DOM needed
    environment: 'node',
  },
})
