import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages project URLs look like https://owner.github.io/repo/ — set BASE_PATH=/repo/
// when building for Actions Pages (see .github/workflows/deploy-pages.yml). User/org sites
// use BASE_PATH=/.
const base = process.env.BASE_PATH?.trim() || '/'

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
  },
})
