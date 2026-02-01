import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
  integrations: [react()],
  srcDir: '.',
  publicDir: './public',
  vite: {
    define: {
      // Mapping the dashboard secret to the internal SDK requirement
      'process.env.API_KEY': JSON.stringify(process.env.GOOGLE_AI_STUDIO_KEY || process.env.API_KEY)
    }
  }
});