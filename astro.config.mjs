import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
  integrations: [react()],
  srcDir: '.',
  publicDir: './public',

  // ❌ DO NOT expose env vars to the client
  // Secrets must ONLY be accessed inside /functions/*
  vite: {
    define: {
      "process.env.API_KEY": "undefined",
      "process.env.GOOGLE_AI_STUDIO_KEY": "undefined",
      "import.meta.env.API_KEY": "undefined"
    }
  }
});
