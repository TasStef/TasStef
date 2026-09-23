import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Projects. Adding a project = adding one Markdown file to
 * src/content/projects/. The schema is enforced at build time, so a
 * malformed entry fails the build rather than rendering broken.
 */
const projects = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
	schema: z.object({
		title: z.string(),
		/** Where it was built. Most of the credibility for internal systems. */
		where: z.string(),
		blurb: z.string().max(180, 'Keep the row blurb short enough to scan.'),
		tech: z.array(z.string()).min(1),
		/** Picks the illustration in src/components/diagrams/. */
		diagram: z.enum([
			'accounting-integration',
			'webhook-payments',
			'event-services',
			'feature-flags',
			'reporting-pipelines',
			'support-automation',
		]),
		/** Headline outcomes. Kept plural: the strongest work has more than one. */
		metrics: z
			.array(
				z.object({
					value: z.string(),
					label: z.string(),
				})
			)
			.optional(),
		/* Optional: these are internal systems, so most will never be public.
		 * Kept for any future project that is. */
		repo: z.url().optional(),
		live: z.url().optional(),
		status: z.enum(['live', 'wip', 'archived']).optional(),
		featured: z.boolean().default(false),
		order: z.number().default(99),
	}),
});

/**
 * Experience. One YAML file per role in src/data/experience/.
 * `end: null` marks the current role.
 */
const experience = defineCollection({
	loader: glob({ pattern: '**/*.yaml', base: './src/data/experience' }),
	schema: z.object({
		company: z.string(),
		context: z.string().optional(),
		title: z.string(),
		location: z.string(),
		start: z.string(),
		end: z.string().nullable(),
		order: z.number(),
		highlights: z.array(z.string()).min(1),
	}),
});

export const collections = { projects, experience };
