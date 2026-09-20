/**
 * All client-side motion for the site. Kept in one module so the total JS
 * cost is visible in one place.
 *
 * Shared rules, applied by every function here:
 *  - The DOM already contains the final, correct content. Motion only ever
 *    animates *towards* what is already there, so nothing is wrong or
 *    missing if this file fails to load or execute.
 *  - Everything is skipped entirely under prefers-reduced-motion.
 */

const reduced = () =>
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Fire `fn` once, the first time `el` scrolls into view. */
function onceInView(el: Element, fn: () => void, rootMargin = '0px 0px -10% 0px') {
	if (!('IntersectionObserver' in window)) {
		fn();
		return;
	}
	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (!e.isIntersecting) continue;
				io.unobserve(e.target);
				fn();
			}
		},
		{ rootMargin, threshold: 0.2 }
	);
	io.observe(el);
}

/* ------------------------------------------------------------------ */
/* Scroll reveal                                                       */
/* ------------------------------------------------------------------ */

export function initReveal() {
	const targets = document.querySelectorAll<HTMLElement>('.reveal');
	if (reduced() || !('IntersectionObserver' in window) || !targets.length) return;

	// Added only from here, so the hiding rules in global.css never apply
	// unless this code is running and able to undo them.
	document.documentElement.classList.add('has-reveal');

	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (!e.isIntersecting) continue;
				e.target.classList.add('is-visible');
				io.unobserve(e.target);
			}
		},
		{ rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
	);
	for (const el of targets) io.observe(el);

	// Safety net: reveal everything rather than risk stranding content.
	window.setTimeout(() => {
		for (const el of targets) el.classList.add('is-visible');
	}, 3000);
}

/* ------------------------------------------------------------------ */
/* Text scramble                                                       */
/* ------------------------------------------------------------------ */

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\#%$&*<>[]';

/**
 * Picks a stand-in glyph for one character.
 *
 * `alpha` mode substitutes letters of the SAME CASE as the target, which is
 * what a name needs: the punctuation-heavy default set reads as technical at
 * label size but as corrupted text at display size.
 */
function randomGlyph(target: string, mode: string | undefined) {
	if (mode === 'alpha') {
		const isLower = target >= 'a' && target <= 'z';
		const base = isLower ? 97 : 65;
		return String.fromCharCode(base + ((Math.random() * 26) | 0));
	}
	return GLYPHS[(Math.random() * GLYPHS.length) | 0];
}

/**
 * Resolves each character from a random glyph to its real value on a
 * stagger, so the label appears to decode.
 */
function scramble(el: HTMLElement, durationMs = 620) {
	const final = el.textContent ?? '';
	const mode = el.dataset.scrambleSet;
	if (!final.trim()) return;

	// Each character locks in at its own point in the timeline. Earlier
	// characters settle first, so the label reads as decoding left-to-right
	// with some jitter, rather than snapping all at once.
	const revealAt = [...final].map(
		(_, i) => (i / final.length) * 0.55 + Math.random() * 0.4
	);
	const t0 = performance.now();

	const tick = (now: number) => {
		const p = Math.min(1, (now - t0) / durationMs);
		let out = '';
		let settled = 0;

		for (let i = 0; i < final.length; i++) {
			const ch = final[i];
			if (ch === ' ') {
				out += ' ';
				settled++;
				continue;
			}
			if (p >= revealAt[i]) {
				out += ch;
				settled++;
			} else {
				out += randomGlyph(ch, mode);
			}
		}

		el.textContent = out;

		if (settled < final.length) {
			requestAnimationFrame(tick);
		} else {
			el.textContent = final; // always land exactly on the real text
		}
	};

	requestAnimationFrame(tick);
}

export function initScramble() {
	const targets = document.querySelectorAll<HTMLElement>('[data-scramble]');
	if (reduced()) return;

	for (const el of targets) {
		// Lock the CURRENT rendered height so glyph substitution cannot change
		// where the text wraps and shift everything below it.
		//
		// This used to lock min-width in `ch`, which worked for a small mono
		// label but overflows a large proportional heading on narrow screens.
		// Height is the dimension that actually causes layout shift.
		const { height } = el.getBoundingClientRect();
		if (height) el.style.minHeight = `${Math.ceil(height)}px`;

		if (el.hasAttribute('data-scramble-now')) {
			scramble(el);
		} else {
			onceInView(el, () => scramble(el));
		}
	}
}

/* ------------------------------------------------------------------ */
/* Count-up numbers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Counts from 0 up to the value already rendered in the element.
 *
 * The final number is server-rendered, so with JS disabled the real figure
 * is shown rather than a zero.
 */
export function initCounters() {
	const targets = document.querySelectorAll<HTMLElement>('[data-count-to]');

	for (const el of targets) {
		const to = Number(el.dataset.countTo);
		if (!Number.isFinite(to)) continue;

		if (reduced()) continue; // leave the server-rendered value in place

		onceInView(el, () => {
			const duration = 1400;
			const t0 = performance.now();

			const tick = (now: number) => {
				const p = Math.min(1, (now - t0) / duration);
				el.textContent = String(Math.round(easeOut(p) * to));
				if (p < 1) requestAnimationFrame(tick);
				else el.textContent = String(to);
			};

			el.textContent = '0';
			requestAnimationFrame(tick);
		});
	}
}

/* ------------------------------------------------------------------ */
/* Collapsible experience cards                                        */
/* ------------------------------------------------------------------ */

/**
 * Collapses each experience card behind a toggle.
 *
 * Progressive enhancement, the same contract as everything else here: the
 * page ships fully expanded with the toggle button hidden. This function
 * un-hides the control and collapses the cards. If it never runs, every
 * card is simply open and there is no dead button to click.
 */
export function initCollapsibles() {
	const stints = document.querySelectorAll<HTMLElement>('.stint');
	if (!stints.length) return;

	document.documentElement.classList.add('has-collapse');

	stints.forEach((stint, i) => {
		const btn = stint.querySelector<HTMLButtonElement>('.stint-toggle');
		const head = stint.querySelector<HTMLElement>('.stint-head');
		const content = stint.querySelector<HTMLElement>('.stint-content');
		if (!btn || !head || !content) return;

		if (!content.id) content.id = `stint-content-${i}`;
		btn.setAttribute('aria-controls', content.id);
		btn.hidden = false;

		const setOpen = (open: boolean) => {
			stint.classList.toggle('is-collapsed', !open);
			btn.setAttribute('aria-expanded', String(open));
		};

		setOpen(false);

		const toggle = () => setOpen(stint.classList.contains('is-collapsed'));

		// The button is the accessible control; the header is a larger hit
		// area for the same action. stopPropagation keeps a click on the
		// button from also firing the header handler and cancelling itself.
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			toggle();
		});
		head.addEventListener('click', toggle);
	});
}

export function initMotion() {
	initReveal();
	initScramble();
	initCounters();
	initCollapsibles();
}
