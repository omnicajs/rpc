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
      entry: {
        index: path.resolve(__dirname, './src/index.ts'),
        polyfill: path.resolve(__dirname, './src/polyfill.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
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
      include: ['src/**/*.ts'],
      exclude: ['tests/**'],
      beforeWriteFile(filePath, content) {
        const sourceOutput = `${path.sep}dist${path.sep}src${path.sep}`

        if (filePath.includes(sourceOutput)) {
          return {
            filePath: filePath.replace(sourceOutput, `${path.sep}dist${path.sep}`),
            content,
          }
        }

        return {filePath, content}
      },
    }),
  ],
})
