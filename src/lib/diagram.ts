/**
 * Shared geometry helpers for the project diagrams.
 *
 * Positions are derived rather than written down, so adding or removing a
 * node rebalances its lane instead of leaving a gap behind.
 */

/** Dash length, in viewBox units. Must match --flow-dash in diagram.css. */
export const DASH = 14;

/** Spaces items evenly between two x positions. */
export function spread<T>(
	items: T[],
	start: number,
	end: number
): (T & { x: number })[] {
	if (items.length === 0) return [];
	if (items.length === 1) {
		return [{ ...items[0], x: (start + end) / 2 }];
	}
	const step = (end - start) / (items.length - 1);
	return items.map((item, i) => ({ ...item, x: start + i * step }));
}

/**
 * Inline style for a flow path of a given length.
 *
 * Keeping this in one place means a track and its flow cannot fall out of
 * step, which breaks the loop silently: the dash stops spanning the path
 * and the animation quietly stops looking seamless.
 */
export function flowStyle(length: number): string {
	return `--len: ${length}px; --gap: ${length - DASH}px; --flow-dash: ${DASH}px`;
}
