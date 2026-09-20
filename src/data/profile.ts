export interface SocialLink {
	label: string;
	href: string;
	handle: string;
}

export interface Interest {
	name: string;
	icon: 'espresso' | 'gloves' | 'chess';
	/** One short line. This is what gives the block character; the icon
	 *  alone just makes it prettier. */
	note: string;
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
	/** One-line hook shown under the name. Keep it short and concrete. */
	pitch: string;
	/** Two or three sentences of context. */
	intro: string;
	/** Short form for <meta description>; search results truncate the full intro. */
	metaDescription: string;
	email: string;
	socials: SocialLink[];
	education: Education[];
	interests: Interest[];
}

// TODO(content): the pitch and intro are drafted from the CV. Rewrite in
// your own voice; this is the first thing anyone reads.
export const profile: Profile = {
	name: 'Tasos Stefanidis',
	title: 'Software Engineer',
	role: 'Full Stack Software Engineer',
	pitch: 'I take features from idea to production, and own everything in between',
	intro:
		'Full Stack Software Engineer experienced in designing and delivering production-grade web applications and backend systems. Comfortable owning features end-to-end, from architecture and data modeling to frontend implementation and deployment. Strong focus on system reliability, performance, and pragmatic engineering decisions in fast-moving environments.',
	metaDescription:
		'Full stack software engineer. I design and deliver production-grade web applications and backend systems, owning features from architecture to deployment.',
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
	// TODO(content): the notes below are my drafts, not Tasos's words.
	// They are attitudes rather than invented facts, but they should still
	// be replaced with his own before this ships.
	interests: [
		{
			name: 'Espresso',
			icon: 'espresso',
			note: 'Always chasing a better shot than yesterday.',
		},
		{
			name: 'Martial arts',
			icon: 'gloves',
			note: 'Reliably humbling. Good practice for code review.',
		},
		{
			name: 'Chess',
			icon: 'chess',
			note: 'Much better at openings than endgames.',
		},
	],
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
