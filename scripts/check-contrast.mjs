/**
 * Parses src/styles/tokens.css and checks every text/background pairing
 * against WCAG AA (4.5:1) in BOTH colour schemes.
 *
 * Also checks text against the LIT background: the ambient orbs are fixed
 * to the viewport, so every line on the page can end up sitting on them,
 * and where the two orbs overlap they are at their brightest. That overlap
 * is the real worst case and it is what caps --glow / --glow-2.
 *
 * Run with `npm run check:contrast`. This exists because the accent is
 * defined twice, once per scheme, and it is easy to change one and forget
 * the other. Eyeballing does not catch that; this does.
 */
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

const hex = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = (h) => { const [r, g, b] = hex(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const toHex = (rgb) => '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
/** Composite a translucent layer over an opaque one, as the browser does. */
const over = (layer, bg) => layer.rgb.map((c, i) => c * layer.a + bg[i] * (1 - layer.a));

// The light block is the :root inside the prefers-color-scheme media query.
const lightStart = css.indexOf('@media (prefers-color-scheme: light)');
const darkSrc = css.slice(0, lightStart);
const lightSrc = css.slice(lightStart);

const vars = (src) => {
	const out = {};
	for (const [, k, v] of src.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[k] = v;
	return out;
};

const rgbaVars = (src) => {
	const out = {};
	const re = /--([\w-]+):\s*rgba\(([^)]+)\)\s*;/g;
	for (const [, k, args] of src.matchAll(re)) {
		const [r, g, b, a] = args.split(',').map((n) => Number(n.trim()));
		if ([r, g, b, a].every(Number.isFinite)) out[k] = { rgb: [r, g, b], a };
	}
	return out;
};

const schemes = [
	['DARK ', vars(darkSrc), rgbaVars(darkSrc)],
	[
		'LIGHT',
		{ ...vars(darkSrc), ...vars(lightSrc) },
		{ ...rgbaVars(darkSrc), ...rgbaVars(lightSrc) },
	],
];

const AA = 4.5;
let failures = 0;

for (const [name, v, rgba] of schemes) {
	console.log(`\n${name}  bg ${v.bg}  accent ${v.accent}`);
	const pairs = [
		['body text', v.text, v.bg],
		['muted text', v['text-muted'], v.bg],
		['accent as link', v.accent, v.bg],
		['ink on accent fill', v['accent-ink'], v.accent],
		['accent-dim on bg', v['accent-dim'], v.bg],
	];
	for (const [label, fg, bg] of pairs) {
		if (!fg || !bg) { console.log(`   SKIP ${label} (missing token)`); continue; }
		const r = ratio(fg, bg);
		const ok = r >= AA;
		if (!ok) failures++;
		console.log(`   ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(20)}${r.toFixed(2)}:1`);
	}
	// The lit background: both orbs overlapping is where the page is
	// brightest, and muted text is the first thing to fail on it.
	if (rgba.glow && rgba['glow-2']) {
		const lit = toHex(over(rgba['glow-2'], over(rgba.glow, hex(v.bg))));
		console.log(`   -- under both orbs, bg becomes ${lit}`);
		for (const [label, fg] of [
			['body text on glow', v.text],
			['muted text on glow', v['text-muted']],
		]) {
			const r = ratio(fg, lit);
			const ok = r >= AA;
			if (!ok) failures++;
			console.log(`   ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(20)}${r.toFixed(2)}:1`);
		}
	} else {
		// Counts as a failure on purpose. A check that cannot find its
		// tokens must not report success: this branch once fired because
		// the parser was broken, and the script still printed "all clear".
		failures++;
		console.log('   FAIL lit-background check — --glow tokens not parsed');
	}

	// --accent-2 is gradient-only, so it is reported but not enforced.
	if (v['accent-2']) {
		console.log(`   --   accent-2 (gradient only) ${ratio(v['accent-2'], v.bg).toFixed(2)}:1`);
	}
}

console.log(
	failures === 0
		? `\nAll pairings clear WCAG AA (${AA}:1).`
		: `\n${failures} pairing(s) below ${AA}:1.`
);
process.exit(failures === 0 ? 0 : 1);
