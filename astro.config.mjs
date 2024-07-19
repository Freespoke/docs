import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
	site: "https://docs.freespoke.com",
	integrations: [
		starlight({
			title: 'Freespoke',
			social: {
				github: 'https://github.com/Freespoke',
			},
			sidebar: [
				'get-started',
				{
					label: 'Freespoke Premium',
					autogenerate: { directory: 'premium' },
				},
				{
					label: 'About Freespoke',
					autogenerate: { directory: 'about' },
				},
				{
					label: 'Privacy',
					autogenerate: { directory: 'privacy' },
				}
			],
			customCss: ['./src/tailwind.css'],
		}),
		tailwind({ applyBaseStyles: false }),
	],
});
