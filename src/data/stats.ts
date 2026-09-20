export interface Stat {
	/** Counted up to. Must be a plain number; units go in `suffix`. */
	value: number;
	suffix: string;
	label: string;
}

// Drawn from the CV. Every figure here is one Tasos already claims in
// writing, so nothing on the site overstates what the CV says.
export const stats: Stat[] = [
	{ value: 6, suffix: 'yrs', label: 'Shipping production systems' },
	{ value: 90, suffix: '%', label: 'Faster client onboarding' },
	{ value: 30, suffix: '%', label: 'Less test suite flakiness' },
	{ value: 25, suffix: '%', label: 'Fewer support tickets' },
];
