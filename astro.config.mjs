// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// User site: the repo is named TasStef.github.io, so the site is served from
// the domain root and BASE stays '/'. A project repo would instead need
// BASE = '/portfolio' and nothing else changed.
const SITE = 'https://tasstef.github.io';
const BASE = '/';

// https://astro.build/config
export default defineConfig({
	site: SITE,
	base: BASE,
	integrations: [
		sitemap(),
	],
	build: {
		// Emit /about/index.html rather than /about.html so GitHub Pages
		// resolves extensionless URLs correctly.
		format: 'directory',
	},
});
