export interface SocialLink {
	label: string;
	href: string;
	handle: string;
}

export interface Profile {
	name: string;
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
// TODO(setup): replace the placeholder GitHub and LinkedIn URLs.
export const profile: Profile = {
	name: 'Tasos Stefanidis',
	role: 'Full Stack Software Engineer',
	location: 'London, UK',
	pitch: 'I build the systems that move other people’s money.',
	intro:
		'Full stack engineer working across .NET and TypeScript, currently at Tipalti. Four years in fintech building payment and treasury systems where correctness is not negotiable. I like owning a feature end to end, from data model to deployment.',
	email: 'tasos.stefanidis@outlook.com',
	socials: [
		{
			label: 'GitHub',
			href: 'https://github.com/YOUR-USERNAME',
			handle: '@YOUR-USERNAME',
		},
		{
			label: 'LinkedIn',
			href: 'https://linkedin.com/in/YOUR-HANDLE',
			handle: '/in/YOUR-HANDLE',
		},
	],
};
