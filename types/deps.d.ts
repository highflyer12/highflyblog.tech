// This module should contain type definitions for modules which do not have
// their own type definitions and are not available on DefinitelyTyped.
// 【TypeScript automatically includes all `.d.ts` files in your project, as long as they are in your project directory or in directories above it. This is controlled by the `include` and `exclude` options in your `tsconfig.json` file.】

// declare module 'some-untyped-pkg' {
// 	export function foo(): void;
// }
declare module 'md5-hash' {
	import md5Hash from 'md5-hash'
	const md5 = md5Hash as unknown as (str: string) => string
	export default md5
}

declare module 'react-lite-youtube-embed/dist/index.es.jsx' {
	import LiteYouTubeEmbed, { type LiteYouTube } from 'react-lite-youtube-embed'
	export default function LiteYouTubeEmbed(props: LiteYouTube): JSX.Element
}
