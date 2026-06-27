// astro.config.mjs
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://prepcenter.ruahtecnologia.com.br',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
