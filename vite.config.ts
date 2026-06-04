import path from 'node:path'

import {defineConfig} from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~tests': path.resolve(__dirname, './tests'),
    },
  },
  build: {
    lib: {
      name: '@omnicajs/rpc',
      entry: path.resolve(__dirname, './src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    minify: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
  plugins: [
    dts({
      include: ['src'],
      exclude: ['tests/**'],
      rollupTypes: true,
    }),
  ],
})
