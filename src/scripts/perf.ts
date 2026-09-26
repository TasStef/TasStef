/**
 * Performance instrumentation, development only.
 *
 * Stripped from the production build: everything here sits behind
 * `import.meta.env.DEV` at the call site in motion.ts, so none of it ships.
 *
 * Two things worth measuring, and they are not the same question:
 *
 *  - FIRST LOAD. Does anything block the first paint? A long task before
 *    first contentful paint is felt as the page "hanging" before it appears.
 *  - SUSTAINED SMOOTHNESS. Jank is intermittent, so an average frame rate
 *    hides it. What matters is the worst frames, not the mean.
 *
 * Usage from the console:
 *
 *    perf()        one-shot report: load metrics + a 3s frame sample
 *    perf.hud()    live overlay, for watching while you scroll
 *    perf.hud(false)   turn it off
 */

interface LongTask {
	start: number;
	dur: number;
}

const longTasks: LongTask[] = [];
let lcpMs: number | null = null;

/**
 * Observers are registered at module load, as early as possible, because
 * long tasks during startup are exactly the ones that matter and they are
 * over before any console command could ask about them.
 */
export function initPerf() {
	try {
		new PerformanceObserver((list) => {
			for (const e of list.getEntries()) {
				longTasks.push({ start: +e.startTime.toFixed(0), dur: +e.duration.toFixed(1) });
			}
		}).observe({ type: 'longtask', buffered: true });
	} catch {
		/* Safari has no Long Tasks API; the frame sampler still works. */
	}

	try {
		new PerformanceObserver((list) => {
			const es = list.getEntries();
			if (es.length) lcpMs = +es[es.length - 1].startTime.toFixed(0);
		}).observe({ type: 'largest-contentful-paint', buffered: true });
	} catch {
		/* Same. */
	}
}

function loadReport() {
	const nav = performance.getEntriesByType(
		'navigation'
	)[0] as PerformanceNavigationTiming | undefined;
	const paints = Object.fromEntries(
		performance.getEntriesByType('paint').map((p) => [p.name, +p.startTime.toFixed(0)])
	);
	const fcp = paints['first-contentful-paint'] ?? null;

	// Total Blocking Time: the part of each long task beyond 50ms. This is
	// the number that correlates with a page feeling unresponsive.
	const tbt = +longTasks.reduce((a, t) => a + Math.max(0, t.dur - 50), 0).toFixed(1);

	// A long task that ENDS before first paint is delaying the paint itself,
	// which is the worst kind: the user sees nothing at all while it runs.
	const blockingPaint = fcp
		? longTasks.filter((t) => t.start < fcp).map((t) => `${t.dur}ms at ${t.start}ms`)
		: [];

	return {
		firstContentfulPaintMs: fcp,
		largestContentfulPaintMs: lcpMs,
		domInteractiveMs: nav ? +nav.domInteractive.toFixed(0) : null,
		longTasks: longTasks.length,
		longestTaskMs: longTasks.length ? Math.max(...longTasks.map((t) => t.dur)) : 0,
		totalBlockingTimeMs: tbt,
		tasksDelayingFirstPaint: blockingPaint,
	};
}

/** Samples real frame intervals. Percentiles, not an average: jank hides in the tail. */
function sampleFrames(ms: number): Promise<{
	fps: number;
	medianMs: number;
	p95Ms: number;
	worstMs: number;
	droppedOver32ms: number;
	frames: number;
}> {
	return new Promise((resolve) => {
		const deltas: number[] = [];
		let last = performance.now();
		const t0 = last;
		const tick = (now: number) => {
			deltas.push(now - last);
			last = now;
			if (now - t0 < ms) {
				requestAnimationFrame(tick);
				return;
			}
			deltas.shift(); // first interval spans the call itself
			const sorted = [...deltas].sort((a, b) => a - b);
			const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
			resolve({
				fps: Math.round(1000 / mean),
				medianMs: +sorted[sorted.length >> 1].toFixed(1),
				p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
				worstMs: +sorted[sorted.length - 1].toFixed(1),
				droppedOver32ms: deltas.filter((d) => d > 32).length,
				frames: deltas.length,
			});
		};
		requestAnimationFrame((t) => {
			last = t;
			requestAnimationFrame(tick);
		});
	});
}

let hudEl: HTMLElement | null = null;
let hudRunning = false;

function hud(on = true) {
	if (!on) {
		hudRunning = false;
		hudEl?.remove();
		hudEl = null;
		return;
	}
	if (hudEl) return;

	hudEl = document.createElement('div');
	hudEl.style.cssText = [
		'position:fixed',
		'top:8px',
		'right:8px',
		'z-index:99999',
		'font:11px/1.5 ui-monospace,Menlo,Consolas,monospace',
		'background:rgba(0,0,0,.82)',
		'color:#d6dae1',
		'padding:8px 10px',
		'border:1px solid rgba(255,255,255,.18)',
		'border-radius:8px',
		'white-space:pre',
		'pointer-events:none',
	].join(';');
	document.body.appendChild(hudEl);

	hudRunning = true;
	let frames = 0;
	let last = performance.now();
	let worst = 0;
	let dropped = 0;
	let prev = last;

	const tick = (now: number) => {
		if (!hudRunning) return;
		const d = now - prev;
		prev = now;
		if (d > worst) worst = d;
		if (d > 32) dropped++;
		frames++;

		if (now - last >= 500) {
			const fps = Math.round((frames * 1000) / (now - last));
			const stats = (window as unknown as { fieldStats?: Record<string, number> })
				.fieldStats;
			const lines = [
				`${fps} fps   worst ${worst.toFixed(0)}ms`,
				`dropped(>32ms) ${dropped}`,
			];
			if (stats) {
				lines.push(
					`nodes ${stats.nodesDrawn}/${stats.nodes}`,
					`edges ${stats.edgesDrawn}/${stats.edges}`,
					`build ${stats.buildMs}ms`
				);
			}
			if (hudEl) hudEl.textContent = lines.join('\n');
			frames = 0;
			worst = 0;
			dropped = 0;
			last = now;
		}
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
}

/** One-shot report. Scroll around first if you want the sample to be honest. */
async function report(sampleMs = 3000) {
	const load = loadReport();
	console.group('%cperf', 'font-weight:700');
	console.log('First load');
	console.table(load);
	if (load.tasksDelayingFirstPaint.length) {
		console.warn(
			'These long tasks ran BEFORE first paint, so the page was blank while they did:',
			load.tasksDelayingFirstPaint
		);
	}
	console.log(`Sampling frames for ${sampleMs}ms...`);
	const frames = await sampleFrames(sampleMs);
	console.log('Runtime');
	console.table(frames);
	const stats = (window as unknown as { fieldStats?: Record<string, number> }).fieldStats;
	if (stats) {
		console.log('Field workload');
		console.table(stats);
	}
	console.groupEnd();
	return { load, frames, field: stats };
}

export function exposePerf() {
	const api = Object.assign(report, { hud, frames: sampleFrames, load: loadReport });
	Object.assign(window, { perf: api });
}
