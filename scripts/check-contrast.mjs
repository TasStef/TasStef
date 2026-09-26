/**
 * Parses src/styles/tokens.css and checks every text/background pairing
 * against WCAG AA (4.5:1) in BOTH colour schemes.
 *
 * Also checks text against a LIT background built from --glow / --glow-2.
 *
 * The two orbs this originally modelled are gone, replaced by the light
 * field in src/scripts/field.ts, whose brightness is a render-time property
 * and cannot be derived from tokens. The model is kept deliberately as an
 * over-estimate: it composites both glow tokens at full overlap, which is
 * brighter than anything the field actually puts behind text (measured peak
 * rgb(30,31,37) against this model's #33314d). So passing here is a
 * stricter bar than the page itself, and the field is verified separately
 * by sampling real canvas pixels under every text node.
 *
 * Product marks are checked too, at the 3:1 graphical-object bar.
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
// WCAG 1.4.11: non-text graphical objects need 3:1, not 4.5:1.
const AAG = 3;
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
	// A deliberately pessimistic stack: page background, both glow tokens at
	// full overlap, a hovered card fill, then the sheen at the top of that
	// card. Muted text is always the first thing to fail on it.
	if (rgba.glow && rgba['glow-2']) {
		const litRgb = over(rgba['glow-2'], over(rgba.glow, hex(v.bg)));
		const lit = toHex(litRgb);
		console.log(`   -- under full glow overlap, bg becomes ${lit}`);

		const layers = [['on glow', lit]];
		if (rgba['surface-hover']) {
			const card = over(rgba['surface-hover'], litRgb);
			layers.push(['on hovered card', toHex(card)]);
			if (rgba['sheen-top']) {
				layers.push(['on card sheen', toHex(over(rgba['sheen-top'], card))]);
			}
		}

		for (const [where, bg] of layers) {
			for (const [who, fg] of [
				['body text', v.text],
				['muted text', v['text-muted']],
			]) {
				const r = ratio(fg, bg);
				const ok = r >= AA;
				if (!ok) failures++;
				console.log(
					`   ${ok ? 'ok  ' : 'FAIL'} ${(who + ' ' + where).padEnd(24)}${r.toFixed(2)}:1  over ${bg}`
				);
			}
		}

		// Product marks are graphical objects, so the bar is 3:1 rather than
		// 4.5:1. Each is checked against the DIMMEST and BRIGHTEST card it
		// can sit on, because a colour tuned for one can fail the other: the
		// dark brands wash out on a lit card and the bright ones on a plain.
		const cardRange = [
			toHex(over(rgba.surface ?? { rgb: [0, 0, 0], a: 0 }, hex(v.bg))),
			layers.at(-1)[1],
		];
		const marks = Object.keys(v)
			.filter((k) => k.startsWith('mark-'))
			.sort();

		if (!marks.length) {
			failures++;
			console.log('   FAIL no --mark-* tokens found');
		}
		for (const k of marks) {
			const rs = cardRange.map((bg) => ratio(v[k], bg));
			const r = Math.min(...rs);
			const ok = r >= AAG;
			if (!ok) failures++;
			console.log(
				`   ${ok ? 'ok  ' : 'FAIL'} ${('--' + k).padEnd(24)}${r.toFixed(2)}:1  ${v[k]}`
			);
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
