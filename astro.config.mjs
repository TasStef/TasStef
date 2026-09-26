// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Project site: the repo is TasStef/TasStef, which is NOT named
// tasstef.github.io, so Pages serves it from a subpath rather than the
// domain root. SITE is the bare origin -- Astro.site never includes the
// base -- and every absolute URL has to be built from BASE_URL as well,
// or it silently points at the domain root and 404s.
const SITE = 'https://tasstef.github.io';
const BASE = '/TasStef/';

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
