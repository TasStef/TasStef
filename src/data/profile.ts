export interface SocialLink {
	label: string;
	href: string;
	handle: string;
}

export interface Education {
	institution: string;
	qualification: string;
	location: string;
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
	education: Education[];
	interests: string[];
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
	education: [
		{
			institution: 'University of Thessaly',
			qualification: 'MSc Electrical & Computer Engineering',
			location: 'Greece',
		},
		{
			institution: 'University of East London',
			qualification: 'MA Creative Music Production',
			location: 'London, UK',
		},
	],
	interests: ['Espresso culture', 'Mixed martial arts', 'Chess'],
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
