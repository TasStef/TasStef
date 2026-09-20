// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// TODO(setup): replace with the real GitHub username before the first deploy.
// User site  -> site: 'https://<username>.github.io', base: '/'
// Project repo -> site: 'https://<username>.github.io', base: '/portfolio'
const SITE = 'https://YOUR-USERNAME.github.io';
const BASE = '/';

// https://astro.build/config
export default defineConfig({
	site: SITE,
	base: BASE,
	integrations: [sitemap()],
	build: {
		// Emit /about/index.html rather than /about.html so GitHub Pages
		// resolves extensionless URLs correctly.
		format: 'directory',
	},
});
