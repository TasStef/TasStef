export interface SkillGroup {
	name: string;
	items: string[];
}

export const skillGroups: SkillGroup[] = [
	{ name: 'Languages', items: ['C#', 'TypeScript', 'JavaScript', 'Python'] },
	{
		name: 'Backend',
		items: ['.NET', 'Node.js', 'GraphQL', 'RabbitMQ', 'MCP', 'AI workflows'],
	},
	{ name: 'Frontend', items: ['Angular', 'React', 'HTML', 'CSS', 'Astro'] },
	{
		name: 'Architecture',
		items: ['Event-driven', 'AI-driven development', 'Domain modelling'],
	},
	{ name: 'Cloud & DevOps', items: ['AWS', 'Azure', 'Docker', 'Jenkins', 'CI/CD'] },
	{
		name: 'Databases',
		items: ['PostgreSQL', 'MySQL', 'SQL Server', 'DynamoDB', 'MongoDB', 'Redis'],
	},
];
