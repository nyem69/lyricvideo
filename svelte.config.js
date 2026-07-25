import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Single deploy target: Cloudflare, served at the domain root, so the base path
// is always ''. GitHub Pages was retired 2026-07-25 (its subpath base forced
// `/lyricvideo`, which made local dev diverge from prod and blocked the
// localized-crawler SEO work). A root base is also what a Capacitor wrapper
// wants, so the old CAPACITOR branch is redundant rather than lost.
//
// If a subpath deploy is ever needed again, set it here — do NOT reintroduce
// env-conditional paths: two bases means every asset URL has two truths.

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapterStatic({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false
    }),
    paths: {
      base: ''
    },
    alias: {
      $components: 'src/lib/components'
    }
  }
};

export default config;
