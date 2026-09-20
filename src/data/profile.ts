export interface SocialLink {
	label: string;
	href: string;
	handle: string;
}

export interface Profile {
	name: string;
	title: string;
	role: string;
	location: string;
	/** One-line hook shown under the name. Keep it short and concrete. */
	pitch: string;
	/** Two or three sentences of context. */
	intro: string;
	email: string;
	socials: SocialLink[];
}

// TODO(content): the pitch and intro are drafted from the CV. Rewrite in
// your own voice; this is the first thing anyone reads.
export const profile: Profile = {
	name: 'Tasos Stefanidis',
	title: 'Software Engineer',
	role: 'Full Stack Software Engineer',
	location: 'London, UK',
	pitch: 'I build the systems that move other people’s money.',
	intro:
		'Full stack software engineer working across .NET and TypeScript, currently at Tipalti. Four years in fintech building payment and treasury systems where correctness is not negotiable. I like owning a feature end to end, from data model to deployment.',
	email: 'tasos.stefanidis@outlook.com',
	socials: [
		{
			label: 'GitHub',
			href: 'https://github.com/TasStef',
			handle: '@TasStef',
		},
		{
			label: 'LinkedIn',
			href: 'https://www.linkedin.com/in/tasos-stefanidis/',
			handle: '/in/tasos-stefanidis',
		},
	],
};
