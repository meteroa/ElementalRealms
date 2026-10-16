import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

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
      name: 'ai-battle-logger',
      configureServer(server) {
        server.middlewares.use('/api/record-ai-log', (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                const logText = parsed.logText || '';
                const logPath = path.resolve(process.cwd(), '../tools/battle_ai_records.txt');
                fs.appendFileSync(logPath, logText.trim() + '\n\n', 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, savedTo: logPath }));
              } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: String(e) }));
              }
            });
            return;
          }
          res.writeHead(405);
          res.end();
        });
      },
    },
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

