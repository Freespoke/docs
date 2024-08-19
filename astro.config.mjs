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
			customCss: ['./src/tailwind.css'],
		}),
		tailwind({ applyBaseStyles: false }),
	],
});
