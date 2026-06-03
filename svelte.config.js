import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isCapacitor = process.env.CAPACITOR === 'true';
// Cloudflare Pages sets CF_PAGES=1 during its build. There the site is served
// at the domain root, so the GitHub-Pages subpath base ('/lyricvideo') must be
// dropped or every asset 404s. GitHub Pages still gets the subpath base.
const isCloudflarePages = process.env.CF_PAGES === '1';
const useRootBase = isCapacitor || isCloudflarePages;

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
      base: useRootBase ? '' : '/lyricvideo'
    },
    alias: {
      $components: 'src/lib/components'
    }
  }
};

export default config;
