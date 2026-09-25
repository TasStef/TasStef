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
		const content = stint.querySelector<HTMLElement>('.stint-content');
		if (!btn || !content) return;

		if (!content.id) content.id = `stint-content-${i}`;
		btn.setAttribute('aria-controls', content.id);
		btn.hidden = false;

		const setOpen = (open: boolean) => {
			stint.classList.toggle('is-collapsed', !open);
			btn.setAttribute('aria-expanded', String(open));
		};

		setOpen(false);

		const toggle = () => setOpen(stint.classList.contains('is-collapsed'));

		// One handler on the whole card. Previously this sat on the header,
		// which left the date column, the Current badge, the role-titles
		// line and the card padding all inert.
		//
		// The button needs no handler of its own: its clicks bubble to here,
		// including the synthetic click from keyboard activation.
		stint.addEventListener('click', (e) => {
			const target = e.target as HTMLElement | null;
			if (!target) return;

			// Clicks inside the expanded detail must not close the card, or
			// reading the bullets becomes a way to lose them.
			if (target.closest('.stint-content')) return;

			// Don't treat the end of a text selection as a click.
			if (window.getSelection()?.toString()) return;

			toggle();
		});
	});
}

/* ------------------------------------------------------------------ */
/* Diagram flows                                                       */
/* ------------------------------------------------------------------ */

/**
 * Pauses each diagram's flow animation while its row is off screen.
 *
 * The diagrams loop continuously by design, but six of them carry
 * seventeen animated paths between them, and most are off screen at any
 * moment given the rows are full width. Pausing what cannot be seen keeps
 * every visible diagram alive at a fraction of the cost.
 *
 * Gated on a root class the script adds itself, so with JS unavailable the
 * animations simply run as normal rather than being stuck paused.
 */
export function initDiagrams() {
	const diagrams = document.querySelectorAll<HTMLElement>('.diagram');
	if (!diagrams.length || !('IntersectionObserver' in window)) return;

	document.documentElement.classList.add('has-diagram-pause');

	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				e.target.classList.toggle('is-onscreen', e.isIntersecting);
			}
		},
		{ rootMargin: '120px 0px' }
	);

	for (const d of diagrams) io.observe(d);
}

/* ------------------------------------------------------------------ */
/* Ambient light rig                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fallback driver for the background light, for browsers without
 * scroll-driven CSS animations.
 *
 * The drift itself is defined once, as keyframes in Base.astro. Where the
 * browser supports `animation-timeline: scroll()` it runs them against the
 * document scroll on the compositor and this function does nothing at all.
 * Where it does not, the same keyframes are left paused and seeked by
 * writing scroll progress into --scroll.
 *
 * One set of keyframes, two drivers — so the two paths cannot drift apart.
 */
export function initAmbient() {
	const rig = document.querySelector<HTMLElement>('.lightrig');
	if (!rig) return;

	// Native scroll timelines are both smoother and free; leave them to it.
	if (CSS.supports('animation-timeline: scroll(root block)')) return;

	// Parked at its reduced-motion position by CSS. Driving --scroll here
	// would animate it anyway, since the CSS cannot un-write what JS sets.
	if (reduced()) return;

	let queued = false;

	const write = () => {
		queued = false;
		const max = document.documentElement.scrollHeight - window.innerHeight;
		rig.style.setProperty(
			'--scroll',
			max > 0 ? String(Math.min(1, window.scrollY / max)) : '0'
		);
	};

	// Coalesced to one write per frame. The property is set on the rig
	// rather than on :root so the style invalidation is scoped to the two
	// orbs instead of every element on the page.
	const schedule = () => {
		if (queued) return;
		queued = true;
		requestAnimationFrame(write);
	};

	window.addEventListener('scroll', schedule, { passive: true });
	window.addEventListener('resize', schedule, { passive: true });
	write();
}

/* ------------------------------------------------------------------ */
/* Hover tilt                                                          */
/* ------------------------------------------------------------------ */

/**
 * Tilts a card towards the pointer, so it reads as a panel lying in space
 * rather than a flat rectangle.
 *
 * Purely decorative, so it is gated hard: skipped under reduced motion, and
 * skipped entirely unless the device has a pointer that genuinely hovers.
 * On touch there is no pointerleave to trust, and a card left stuck at an
 * angle after a tap looks broken rather than deliberate.
 *
 * The root class is added only from here, so with this file absent the
 * figures carry no transform at all.
 */
export function initTilt() {
	const cards = document.querySelectorAll<HTMLElement>('.tilt');
	if (!cards.length || reduced()) return;
	if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

	// Kept in step with the return transition in ProjectRow.astro.
	const RETURN_MS = 420;

	const max =
		parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue('--tilt-max')
		) || 5;

	document.documentElement.classList.add('has-tilt');

	for (const card of cards) {
		let frame = 0;
		let returning = 0;

		const onMove = (e: PointerEvent) => {
			// Any return still in flight is abandoned the moment the pointer
			// is back, so tracking is immediate rather than easing first.
			if (returning) {
				window.clearTimeout(returning);
				returning = 0;
				card.classList.remove('is-returning');
			}
			// Coalesced to one write per frame; pointermove fires far more
			// often than the screen refreshes.
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				const r = card.getBoundingClientRect();
				if (!r.width || !r.height) return;

				// -1 at one edge, +1 at the other, so --tilt-max is the
				// rotation reached at the edge rather than half of it.
				const dx = ((e.clientX - r.left) / r.width - 0.5) * 2;
				const dy = ((e.clientY - r.top) / r.height - 0.5) * 2;

				// Inverted signs: the edge nearest the pointer moves away from
				// the viewer, producing a "push" effect rather than a pull.
				card.style.setProperty('--tilt-x', `${(-dy * max).toFixed(2)}deg`);
				card.style.setProperty('--tilt-y', `${(dx * max).toFixed(2)}deg`);
			});
		};

		const reset = () => {
			if (frame) {
				cancelAnimationFrame(frame);
				frame = 0;
			}
			// Ease back rather than snap. Safe to transition here because the
			// angles change exactly once, unlike while tracking.
			card.classList.add('is-returning');
			// Removing rather than zeroing lets the CSS default take over,
			// so the resting state is defined in one place.
			card.style.removeProperty('--tilt-x');
			card.style.removeProperty('--tilt-y');

			window.clearTimeout(returning);
			returning = window.setTimeout(() => {
				returning = 0;
				card.classList.remove('is-returning');
			}, RETURN_MS + 40);
		};

		card.addEventListener('pointermove', onMove);
		card.addEventListener('pointerleave', reset);
		card.addEventListener('pointercancel', reset);
	}
}

export function initMotion() {
	initReveal();
	initScramble();
	initCounters();
	initCollapsibles();
	initDiagrams();
	initAmbient();
	initTilt();
}
