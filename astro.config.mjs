import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';
import freespoke_torch from "./src/assets/freespoke_torch.svg"

// https://astro.build/config
export default defineConfig({
	site: "https://docs.freespoke.com",
	integrations: [
		starlight({
			title: 'Freespoke',
			logo: {
				dark: freespoke_torch,
				light: freespoke_torch,
			},
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
			favicon: '/favicon-16x16.png',
			head: [
				// Add ICO favicon fallback for Safari.
				{
				tag: 'link',
				attrs: {
					rel: 'icon',
					href: '/public/favicon.ico',
					sizes: '32x32',
				},
				},
			],
			customCss: ['./src/tailwind.css', './src/styles/custom.css'],
		}),
		tailwind({ applyBaseStyles: false }),
	],
});
