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
 * Exposure eases from the hero setting to a much lower one past the fold,
 * because a hero can carry light that a paragraph cannot.
 */

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
	/** Palette index. */
	c: number;
	/** Base brightness, so the field is not uniformly lit. */
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

/** Field geometry. The camera sits at the origin looking down +z. */
const SPAN = 1000;
/**
 * Z_NEAR has to be genuinely far from the lens. Projected scale is F/z, so a
 * light allowed to drift close renders as a screen-filling smear.
 */
const Z_NEAR = 700;
const Z_FAR = 2700;
const FOCUS = 1400;
const F = 900;
const LINK_DIST = 560;

/** Exposure at the top of the page, and past the fold. */
const HERO = { gain: 1, edge: 1, pulse: 0.022 };
const BODY = { gain: 0.34, edge: 0.5, pulse: 0.004 };

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

	const nodes: Node[] = [];
	for (let i = 0; i < 190; i++) {
		nodes.push({
			x: (Math.random() - 0.5) * SPAN * 2.4,
			y: (Math.random() - 0.5) * SPAN * 1.6,
			z: Z_NEAR + Math.random() * (Z_FAR - Z_NEAR),
			c: Math.random() < 0.12 ? 2 : Math.random() < 0.5 ? 0 : 1,
			b: 0.45 + Math.random() * 0.55,
			px: Math.random() * Math.PI * 2,
			py: Math.random() * Math.PI * 2,
		});
	}

	/**
	 * Topology is computed ONCE from the base positions. The camera moves and
	 * the nodes only breathe, so recomputing neighbours every frame would burn
	 * O(n^2) for a result that barely changes.
	 */
	const edges: Edge[] = [];
	for (let i = 0; i < nodes.length; i++) {
		let made = 0;
		for (let j = i + 1; j < nodes.length && made < 3; j++) {
			const dx = nodes[i].x - nodes[j].x;
			const dy = nodes[i].y - nodes[j].y;
			const dz = nodes[i].z - nodes[j].z;
			const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
			if (d < LINK_DIST) {
				edges.push({ a: i, b: j, w: 1 - d / LINK_DIST });
				made++;
			}
		}
	}

	const pulses: Pulse[] = [];
	const sx = new Float32Array(nodes.length);
	const sy = new Float32Array(nodes.length);
	const sz = new Float32Array(nodes.length);
	const sa = new Float32Array(nodes.length);
	const order = Array.from(nodes.keys());

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
		return {
			gain: HERO.gain + (BODY.gain - HERO.gain) * e,
			edge: HERO.edge + (BODY.edge - HERO.edge) * e,
			pulse: HERO.pulse + (BODY.pulse - HERO.pulse) * e,
		};
	}

	const draw = (time: number) => {
		const t = time / 1000;
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

		for (let i = 0; i < nodes.length; i++) {
			const n = nodes[i];
			// Idle breathing, small enough that fixed topology still reads.
			const bx = n.x + Math.sin(t * 0.18 + n.px) * 14;
			const by = n.y + Math.cos(t * 0.15 + n.py) * 14;

			const rx = bx * cosY - n.z * sinY - camX;
			const rz = bx * sinY + n.z * cosY;
			const ry = by - camY;

			sz[i] = rz;
			if (rz <= Z_NEAR) {
				sa[i] = 0;
				continue;
			}
			const k = F / rz;
			sx[i] = cx + rx * k;
			sy[i] = cy + ry * k;
			sa[i] = Math.max(0, Math.min(1, (Z_FAR - rz) / 900)) * n.b;
		}

		ctx.globalCompositeOperation = 'lighter';

		// Edges are deliberately faint. A point field wired with prominent
		// lines reads as a particles.js demo; leading with defocused light and
		// keeping the lines as hints is what separates the two.
		ctx.lineWidth = 1;
		for (let e = 0; e < edges.length; e++) {
			const { a, b, w: ew } = edges[e];
			const aa = sa[a];
			const ab = sa[b];
			if (aa <= 0 || ab <= 0) continue;
			const depth = (sz[a] + sz[b]) / 2;
			const fade = Math.max(0, 1 - Math.abs(depth - FOCUS) / 1500);
			const alpha = ew * fade * Math.min(aa, ab) * 0.17 * exp.edge;
			if (alpha < 0.004) continue;
			ctx.strokeStyle = `rgba(${glow[0]}, ${glow[1]}, ${glow[2]}, ${alpha})`;
			ctx.beginPath();
			ctx.moveTo(sx[a], sy[a]);
			ctx.lineTo(sx[b], sy[b]);
			ctx.stroke();
		}

		// Lights, far to near, so nearer bokeh sits on top.
		order.sort((p, q) => sz[q] - sz[p]);
		for (const i of order) {
			const alpha = sa[i];
			if (alpha <= 0.004) continue;
			const rz = sz[i];
			// Defocus grows either side of the focal plane, and an out-of-focus
			// light gets BIGGER and dimmer, not just smaller.
			const defocus = Math.min(1, Math.abs(rz - FOCUS) / 1150);
			const step = Math.min(
				SPRITE_STEPS - 1,
				Math.round(defocus * (SPRITE_STEPS - 1))
			);
			const scale = F / rz;
			const size = Math.min(140, (7 + defocus * 52) * scale);
			if (size < 0.6) continue;
			ctx.globalAlpha = alpha * (1 - defocus * 0.45) * 0.85 * exp.gain;
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
			p.t += p.v * 0.016;
			if (p.t >= 1) {
				pulses.splice(i, 1);
				continue;
			}
			const { a, b } = edges[p.e];
			if (sa[a] <= 0 || sa[b] <= 0) continue;
			const px = sx[a] + (sx[b] - sx[a]) * p.t;
			const py = sy[a] + (sy[b] - sy[a]) * p.t;
			const depth = sz[a] + (sz[b] - sz[a]) * p.t;
			const defocus = Math.min(1, Math.abs(depth - FOCUS) / 1150);
			const step = Math.min(
				SPRITE_STEPS - 1,
				Math.round(defocus * (SPRITE_STEPS - 1))
			);
			// Brightest mid-run, so it reads as a travelling glint rather than a
			// dot that blinks on and off.
			const life = Math.sin(p.t * Math.PI);
			const size = Math.min(70, (6 + defocus * 16) * (F / depth));
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
		scrim.addColorStop(1, `rgba(${bg[0]}, ${bg[1]}, ${bg[2]}, 0.72)`);
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
