import * as simpleIcons from 'simple-icons';

export interface BrandMark {
	title: string;
	/** 24x24 viewBox path data. */
	path: string;
}

/**
 * Looks up a product mark by simple-icons slug. Runs at build time, so the
 * path is inlined into the HTML and simple-icons stays a devDependency that
 * never reaches the browser.
 *
 * Export keys are `si` plus the slug with only its FIRST letter capitalised:
 * `apachekafka` becomes `siApachekafka`, not `siApacheKafka`.
 *
 * Returns null when a slug has no mark, so callers fall back to a text label
 * rather than rendering an empty node. Unleash is the known case.
 */
export function brandMark(slug: string): BrandMark | null {
	const key = `si${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
	const icon = (simpleIcons as Record<string, unknown>)[key] as
		| BrandMark
		| undefined;

	return icon?.path ? { title: icon.title, path: icon.path } : null;
}
