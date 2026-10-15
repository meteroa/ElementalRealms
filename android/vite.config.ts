import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5174,
  },
  preview: {
    port: 5174,
  },
  build: {
    emptyOutDir: false,
    target: 'es2017',
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  plugins: [
    {
      name: 'no-module-script',
      apply: 'build',
      transformIndexHtml(html) {
        return html.replace(
          /<script type="module"([^>]*)>/g,
          '<script defer$1>',
        );
      },
    },
  ],
});
