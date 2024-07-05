/// <reference types="@remix-run/node" />
/// <reference types="vite/client" />
// index.d.ts is a special file in TypeScript. It's often used as the main entry point for type declarations in a TypeScript project or a TypeScript declaration package. It's also used to declare global types for your project. This file is automatically included in your project when you run the TypeScript compiler (tsc) or when you use a TypeScript-aware editor like Visual Studio Code.

export type GitHubFile = { path: string; content: string }

type MdxPage = {
	code: string
	slug: string
	editLink: string
	readTime?: ReturnType<typeof calculateReadingTime>
	dateDisplay?: string

	/**
	 * It's annoying that all these are set to optional I know, but there's
	 * no great way to ensure that the MDX files have these properties,
	 * especially when a common use case will be to edit them without running
	 * the app or build. So we're going to force you to handle situations when
	 * these values are missing to avoid runtime errors.
	 */
	frontmatter: {
		archived?: boolean
		draft?: boolean
		unlisted?: boolean
		title?: string
		description?: string
		meta?: {
			keywords?: Array<string>
			[key as string]: string
		}
		categories?: Array<string>
		date?: string
		bannerBlurDataUrl?: string
		bannerCloudinaryId?: string
		bannerCredit?: string
		bannerAlt?: string
		bannerTitle?: string
		socialImageTitle?: string
		socialImagePreTitle?: string
		translations?: Array<{
			language: string
			link: string
			author?: {
				name: string
				link?: string
			}
		}>
	}
}

export type MdxListItem = Omit<MdxPage, 'code'>

export type Team = 'RED' | 'BLUE' | 'YELLOW'
export type Role = 'ADMIN' | 'MEMBER'
export type OptionalTeam = Team | 'UNKNOWN'

export type Await<Type> =
	Type extends Promise<infer Value> ? Await<Value> : Type

export type KCDHandle = {
	/** this just allows us to identify routes more directly rather than relying on pathnames */
	id?: string
	getSitemapEntries?:
		| ((
				request: Request,
		  ) =>
				| Promise<Array<KCDSitemapEntry | null> | null>
				| Array<KCDSitemapEntry | null>
				| null)
		| null
}
