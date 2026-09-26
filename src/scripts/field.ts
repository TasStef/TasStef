/**
 * The ambient light field: a 3D point cloud rendered behind the whole page.
 *
 * Replaces the two scroll-driven orbs. Those were flat radial gradients, and
 * flat is exactly what they read as. What makes a background feel like space
 * is lit objects at different depths with focus falling off, moving relative
 * to each other — so this projects real 3D points, defocuses them by their
 * distance from a focal plane, and composites them additively.
 *
 * It also rhymes with the six system diagrams further down the page: nodes,
 * edges, and pulses travelling between them.
 *
 * EVERY tunable lives in FIELD below. In dev a slider panel is attached (see
 * fieldTuner.ts) that edits these live and hands back a block to paste here,
 * so the look is dialled in by eye and then committed as numbers.
 */

/* ------------------------------------------------------------------ */
/* Tunables                                                            */
/* ------------------------------------------------------------------ */

export const FIELD = {
	/**
	 * The arrangement of lights is generated from this seed, not from
	 * Math.random(), so every visitor sees the same field and what you tune
	 * is what ships. Change it to deal a different arrangement; the layout
	 * is worth shopping around for, since one draw can put a bright light
	 * somewhere awkward.
	 *
	 * This is also what makes the contrast guarantee meaningful: with a
	 * random field, a passing measurement only described that one page load.
	 */
	seed: 7,

	/** How many lights. Costs roughly linearly; changing it rebuilds. */
	count: 9000,

	/* ---- Depth ----
	 * The camera sits at the origin looking down +z, so bigger numbers are
	 * further away. near has to stay genuinely far from the lens: projected
	 * scale is lens/z, so a light allowed to drift close fills the screen. */
	near: 500,
	far: 1700,
	/** The depth that renders sharp. Lights either side of it defocus. */
	focus: 1400,
	/** Focal length. Higher flattens the perspective, lower exaggerates it. */
	lens: 6900,

	/* ---- Blur ----
	 * bokeh is how far a fully defocused light spreads; falloff is how much
	 * distance from the focal plane it takes to get there. Raise bokeh for
	 * big soft discs, raise falloff to keep more of the field sharp. */
	bokeh: 100,
	falloff: 5150,

	/* ---- Motion ----
	 * One multiplier over every drift rate, so speed can be judged as a
	 * single quality rather than four unrelated numbers. */
	speed: 0.5,

	/* ---- Light ----
	 * exposure is the headline brightness, and the setting most likely to
	 * break text legibility.
	 *
	 * The ceiling is not a matter of taste. Lights drift, so given long
	 * enough ANY light passes behind ANY line of text; the worst case is
	 * over time, not at one instant. Measured by fast-forwarding the drift:
	 * at 0.85 a hot light behind the hero label read 1.95:1 and a violet one
	 * 3.70:1, both under AA. 0.6 with hot at 0.5 is where it clears.
	 *
	 * Raise this and re-run the check before shipping it. */
	exposure: 0.6,
	/** Exposure past the fold, as a fraction of the above. */
	bodyExposure: 0.34,
	/** Edge visibility. Push this up and it starts to read as particles.js. */
	edges: 0.9,
	/** Max 3D distance at which two lights get wired together. Rebuilds. */
	linkDist: 300,
	/** Chance per frame of starting a new pulse, at hero exposure. */
	pulseRate: 0.05,
	/** How much the lower viewport is darkened, to protect small text. */
	scrim: 2,

	/* ---- The near-white lights ----
	 * A handful of neutral lights keep the field from reading as monochrome
	 * blue, but they are also by far the worst offenders for contrast,
	 * being the brightest thing on the canvas. hot scales their brightness,
	 * hotShare is what fraction of the lights are neutral rather than
	 * coloured. */
	hot: 0.5,
	hotShare: 0.12,
};

export type FieldConfig = typeof FIELD;

/** Settings that change the point cloud itself and need a regenerate. */
export const REBUILD_KEYS: (keyof FieldConfig)[] = [
	'seed',
	'count',
	'near',
	'far',
	'linkDist',
];

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];

const reduced = () =>
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Reads a colour token as 0-255 rgb.
 *
 * Handles BOTH forms the token layer uses: --bg and friends are hex, --glow
 * and --surface are rgba(). Matching bare numbers is not enough — on the hex
 * '#06070c' that finds the single run '06070', because the match stops at
 * the 'c', which is one component rather than three.
 *
 * Throws rather than returning a default. A silent fallback here once filled
 * the whole canvas white and read as an exposure problem rather than as the
 * parse failure it actually was.
 */
function token(name: string): RGB {
	const v = getComputedStyle(document.documentElement)
		.getPropertyValue(name)
		.trim();

	const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hex) {
		const h = hex[1];
		const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
		return [
			parseInt(full.slice(0, 2), 16),
			parseInt(full.slice(2, 4), 16),
			parseInt(full.slice(4, 6), 16),
		];
	}

	const nums = v.match(/[0-9.]+/g);
	if (nums && nums.length >= 3) return [+nums[0], +nums[1], +nums[2]];

	throw new Error(`Cannot parse colour token ${name}: "${v}"`);
}

const SPRITE_STEPS = 7;

/**
 * Pre-rendered bokeh sprites, sharp through to fully defocused.
 *
 * A radial gradient per light per frame is the obvious approach and far too
 * slow. These are built once and blitted, which is what makes a couple of
 * hundred lights affordable.
 *
 * The alphas are low on purpose: every sprite composites additively, so what
 * you see is the sum over all the overlapping ones.
 */
function makeSprites(rgb: RGB): HTMLCanvasElement[] {
	const out: HTMLCanvasElement[] = [];
	const [r, g, b] = rgb;

	for (let i = 0; i < SPRITE_STEPS; i++) {
		const blur = i / (SPRITE_STEPS - 1); // 0 sharp .. 1 fully defocused
		const size = 64;
		const c = document.createElement('canvas');
		c.width = size;
		c.height = size;
		const ctx = c.getContext('2d');
		if (!ctx) continue;

		const mid = size / 2;
		const grad = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
		// A sharp light is a tight core with a faint halo; a defocused one
		// spreads into a flatter disc with a soft edge, which is what a lens
		// actually does and what sells the depth.
		const core = 0.04 + blur * 0.42;
		grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.95 - blur * 0.5})`);
		grad.addColorStop(core, `rgba(${r}, ${g}, ${b}, ${0.5 - blur * 0.3})`);
		grad.addColorStop(
			Math.min(0.98, core + 0.22 + blur * 0.2),
			`rgba(${r}, ${g}, ${b}, ${0.09 - blur * 0.045})`
		);
		grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, size, size);
		out.push(c);
	}
	return out;
}

interface Node {
	x: number;
	y: number;
	z: number;
	c: number;
	b: number;
	px: number;
	py: number;
}

interface Edge {
	a: number;
	b: number;
	w: number;
}

interface Pulse {
	e: number;
	t: number;
	v: number;
}

const SPAN = 1000;

/**
 * Small deterministic PRNG (mulberry32). Same seed, same field, every load.
 */
function makeRng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

let regenerate: (() => void) | null = null;

/** Dev-only workload counters, so tuning decisions can be made on numbers. */
export const fieldStats = {
	nodes: 0,
	nodesDrawn: 0,
	edges: 0,
	edgesDrawn: 0,
	buildMs: 0,
};

/** Rebuilds the point cloud, for settings that change the cloud itself. */
export function rebuildField() {
	regenerate?.();
}

if (import.meta.env.DEV) {
	// Console handles, dev only, stripped from the production build.
	//
	//   FIELD.bokeh = 90        // takes effect on the next frame
	//   FIELD.seed = 12; rebuildField()   // for anything in REBUILD_KEYS
	//
	// Settle on numbers here, then write them into FIELD above so they ship.
	Object.assign(window, { FIELD, rebuildField, REBUILD_KEYS, fieldStats });
}

export function initField() {
	const canvas = document.querySelector<HTMLCanvasElement>('.lightfield');
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const isReduced = reduced();

	const glow = token('--glow');
	const palette: RGB[] = [
		glow,
		token('--glow-2'),
		[226, 232, 240], // a few near-white lights, so it is not monochrome blue
	];
	const sprites = palette.map(makeSprites);
	const bg = token('--bg');

	let nodes: Node[] = [];
	let edges: Edge[] = [];
	let sx = new Float32Array(0);
	let sy = new Float32Array(0);
	let sz = new Float32Array(0);
	let sa = new Float32Array(0);
	/**
	 * Indices of the lights actually on screen this frame, refilled in place.
	 * Only these get sorted and drawn: at a long focal length the cloud is
	 * magnified far wider than the viewport, so the overwhelming majority of
	 * lights project off screen and used to be sorted and blitted anyway.
	 */
	let visible = new Int32Array(0);
	let visibleCount = 0;
	const pulses: Pulse[] = [];

	const build = () => {
		// Seeded, so the arrangement is identical on every load. Pulses still
		// use Math.random(): those are meant to be unpredictable.
		const rng = makeRng(FIELD.seed);
		nodes = [];
		for (let i = 0; i < FIELD.count; i++) {
			nodes.push({
				x: (rng() - 0.5) * SPAN * 2.4,
				y: (rng() - 0.5) * SPAN * 1.6,
				z: FIELD.near + rng() * (FIELD.far - FIELD.near),
				c: rng() < FIELD.hotShare ? 2 : rng() < 0.5 ? 0 : 1,
				b: 0.45 + rng() * 0.55,
				px: rng() * Math.PI * 2,
				py: rng() * Math.PI * 2,
			});
		}

		/**
		 * Topology is computed ONCE per build, from the base positions. The
		 * camera moves and the nodes only breathe, so recomputing neighbours
		 * every frame would burn O(n^2) for a result that barely changes.
		 */
		edges = [];
		for (let i = 0; i < nodes.length; i++) {
			let made = 0;
			for (let j = i + 1; j < nodes.length && made < 3; j++) {
				const dx = nodes[i].x - nodes[j].x;
				const dy = nodes[i].y - nodes[j].y;
				const dz = nodes[i].z - nodes[j].z;
				const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
				if (d < FIELD.linkDist) {
					edges.push({ a: i, b: j, w: 1 - d / FIELD.linkDist });
					made++;
				}
			}
		}

		sx = new Float32Array(nodes.length);
		sy = new Float32Array(nodes.length);
		sz = new Float32Array(nodes.length);
		sa = new Float32Array(nodes.length);
		visible = new Int32Array(nodes.length);
		pulses.length = 0;
		fieldStats.nodes = nodes.length;
		fieldStats.edges = edges.length;
	};
	const timedBuild = () => {
		const t0 = performance.now();
		build();
		fieldStats.buildMs = +(performance.now() - t0).toFixed(1);
	};
	timedBuild();
	regenerate = timedBuild;

	let w = 0;
	let h = 0;
	let dpr = 1;
	const resize = () => {
		dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		w = window.innerWidth;
		h = window.innerHeight;
		canvas.width = Math.max(1, Math.round(w * dpr));
		canvas.height = Math.max(1, Math.round(h * dpr));
	};
	resize();
	window.addEventListener('resize', resize, { passive: true });

	/** Exposure eases from the hero setting to the body one across the fold. */
	function exposure() {
		const span = window.innerHeight * 0.8;
		const p = Math.max(0, Math.min(1, window.scrollY / span));
		const e = p * p * (3 - 2 * p); // smoothstep, so there is no visible seam
		const lo = FIELD.exposure * FIELD.bodyExposure;
		return {
			gain: FIELD.exposure + (lo - FIELD.exposure) * e,
			// Edges fall to half past the fold, not to bodyExposure: they are
			// already faint, and taking them down as far as the lights loses
			// the structure entirely.
			edge: FIELD.edges * (1 - 0.5 * e),
			pulse: FIELD.pulseRate * (1 + (0.18 - 1) * e),
		};
	}

	const draw = (time: number) => {
		const t = (time / 1000) * FIELD.speed;
		const exp = exposure();

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.globalCompositeOperation = 'source-over';
		ctx.fillStyle = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
		ctx.fillRect(0, 0, w, h);

		// Slow yaw plus lateral drift. Rotation is what produces real parallax
		// between near and far lights; drifting alone reads as a flat image
		// sliding around.
		const yaw = Math.sin(t * 0.045) * 0.26;
		const cosY = Math.cos(yaw);
		const sinY = Math.sin(yaw);
		const camX = Math.sin(t * 0.031) * 120;
		const camY = Math.cos(t * 0.024) * 70;
		const cx = w / 2;
		const cy = h / 2;

		visibleCount = 0;
		for (let i = 0; i < nodes.length; i++) {
			const n = nodes[i];
			// Idle breathing, small enough that fixed topology still reads.
			const bx = n.x + Math.sin(t * 0.18 + n.px) * 14;
			const by = n.y + Math.cos(t * 0.15 + n.py) * 14;

			const rx = bx * cosY - n.z * sinY - camX;
			const rz = bx * sinY + n.z * cosY;
			const ry = by - camY;

			sz[i] = rz;
			if (rz <= FIELD.near) {
				sa[i] = 0;
				continue;
			}
			const k = FIELD.lens / rz;
			const px = cx + rx * k;
			const py = cy + ry * k;
			sx[i] = px;
			sy[i] = py;
			sa[i] = Math.max(0, Math.min(1, (FIELD.far - rz) / 900)) * n.b;

			// Frustum cull. The sprite's own radius has to be allowed for, or
			// big defocused discs would pop at the edges of the viewport.
			const defocus = Math.min(1, Math.abs(rz - FIELD.focus) / FIELD.falloff);
			const radius = Math.min(140, (7 + defocus * FIELD.bokeh) * k) * 0.5;
			if (
				sa[i] > 0.004 &&
				px + radius >= 0 &&
				px - radius <= w &&
				py + radius >= 0 &&
				py - radius <= h
			) {
				visible[visibleCount++] = i;
			}
		}

		ctx.globalCompositeOperation = 'lighter';

		// Edges are deliberately faint. A point field wired with prominent
		// lines reads as a particles.js demo; leading with defocused light and
		// keeping the lines as hints is what separates the two.
		ctx.lineWidth = 1;
		let drawnEdges = 0;
		for (let e = 0; e < edges.length; e++) {
			const { a, b, w: ew } = edges[e];
			const aa = sa[a];
			const ab = sa[b];
			if (aa <= 0 || ab <= 0) continue;
			// Cheap segment-vs-viewport rejection. Both ends can be off screen
			// while the line still crosses it, so this tests the segment's
			// bounding box rather than the endpoints individually.
			if (
				(sx[a] < 0 && sx[b] < 0) ||
				(sx[a] > w && sx[b] > w) ||
				(sy[a] < 0 && sy[b] < 0) ||
				(sy[a] > h && sy[b] > h)
			) {
				continue;
			}
			const depth = (sz[a] + sz[b]) / 2;
			const fade = Math.max(0, 1 - Math.abs(depth - FIELD.focus) / 1500);
			const alpha = ew * fade * Math.min(aa, ab) * exp.edge;
			if (alpha < 0.004) continue;
			ctx.strokeStyle = `rgba(${glow[0]}, ${glow[1]}, ${glow[2]}, ${alpha})`;
			ctx.beginPath();
			ctx.moveTo(sx[a], sy[a]);
			ctx.lineTo(sx[b], sy[b]);
			ctx.stroke();
			drawnEdges++;
		}
		fieldStats.edgesDrawn = drawnEdges;

		// Lights, far to near, so nearer bokeh sits on top. Sorting the
		// visible subset rather than the whole cloud: this used to sort every
		// node every frame, which at 9000 nodes is ~120k comparisons a frame
		// to order things that are not on screen.
		const draws = visible.subarray(0, visibleCount);
		draws.sort((p, q) => sz[q] - sz[p]);
		fieldStats.nodesDrawn = visibleCount;
		for (const i of draws) {
			const alpha = sa[i];
			const rz = sz[i];
			// Defocus grows either side of the focal plane, and an out-of-focus
			// light gets BIGGER and dimmer, not just smaller.
			const defocus = Math.min(1, Math.abs(rz - FIELD.focus) / FIELD.falloff);
			const step = Math.min(
				SPRITE_STEPS - 1,
				Math.round(defocus * (SPRITE_STEPS - 1))
			);
			const scale = FIELD.lens / rz;
			const size = Math.min(140, (7 + defocus * FIELD.bokeh) * scale);
			if (size < 0.6) continue;
			const hot = nodes[i].c === 2 ? FIELD.hot : 1;
			ctx.globalAlpha = alpha * (1 - defocus * 0.45) * exp.gain * hot;
			ctx.drawImage(
				sprites[nodes[i].c][step],
				sx[i] - size / 2,
				sy[i] - size / 2,
				size,
				size
			);
		}
		ctx.globalAlpha = 1;

		// Pulses: rare, short, travelling along a real edge. The one part that
		// is not ambient — it is the page's own diagram flow, moved behind it.
		if (!isReduced && edges.length && Math.random() < exp.pulse) {
			pulses.push({
				e: (Math.random() * edges.length) | 0,
				t: 0,
				v: 0.14 + Math.random() * 0.18,
			});
		}
		for (let i = pulses.length - 1; i >= 0; i--) {
			const p = pulses[i];
			p.t += p.v * 0.016 * FIELD.speed;
			if (p.t >= 1) {
				pulses.splice(i, 1);
				continue;
			}
			const { a, b } = edges[p.e];
			if (!sa[a] || !sa[b]) continue;
			const px = sx[a] + (sx[b] - sx[a]) * p.t;
			const py = sy[a] + (sy[b] - sy[a]) * p.t;
			const depth = sz[a] + (sz[b] - sz[a]) * p.t;
			const defocus = Math.min(
				1,
				Math.abs(depth - FIELD.focus) / FIELD.falloff
			);
			const step = Math.min(
				SPRITE_STEPS - 1,
				Math.round(defocus * (SPRITE_STEPS - 1))
			);
			// Brightest mid-run, so it reads as a travelling glint rather than a
			// dot that blinks on and off.
			const life = Math.sin(p.t * Math.PI);
			const size = Math.min(70, (6 + defocus * 16) * (FIELD.lens / depth));
			ctx.globalAlpha = life * 0.95 * exp.gain;
			ctx.drawImage(sprites[2][step], px - size / 2, py - size / 2, size, size);
		}

		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';

		// Small text is the binding constraint, not the display type: a stat
		// label over a bright bokeh disc measured 3.70:1 against muted text,
		// under AA, while the hero name over the same field was 6.96:1.
		//
		// Rather than dim the whole field, attenuate the lower part of the
		// viewport, which is where the small text sits at the top of the page.
		// Painted into the canvas on purpose — a CSS layer over the top would
		// mean the rendered pixels and the measurable pixels disagree.
		const scrim = ctx.createLinearGradient(0, h * 0.34, 0, h);
		scrim.addColorStop(0, `rgba(${bg[0]}, ${bg[1]}, ${bg[2]}, 0)`);
		scrim.addColorStop(1, `rgba(${bg[0]}, ${bg[1]}, ${bg[2]}, ${FIELD.scrim})`);
		ctx.fillStyle = scrim;
		ctx.fillRect(0, 0, w, h);
	};

	if (isReduced) {
		// One static frame. The field is composition as much as motion, so it
		// still reads with everything held still.
		draw(0);
		return;
	}

	let running = false;
	const loop = (time: number) => {
		if (!running) return;
		draw(time);
		requestAnimationFrame(loop);
	};
	const start = () => {
		if (running) return;
		running = true;
		requestAnimationFrame(loop);
	};
	const stop = () => {
		running = false;
	};

	// The field is fixed to the viewport, so it is always on screen; the only
	// thing worth pausing for is the tab being hidden.
	document.addEventListener('visibilitychange', () =>
		document.hidden ? stop() : start()
	);
	start();
}
