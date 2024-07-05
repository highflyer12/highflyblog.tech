import { buildImageUrl } from 'cloudinary-build-url'
import { type GitHubFile, type MdxPage } from '../../types'
import { cache, cachified } from './cache.server'
import { compileMdx } from './compile-mdx.server'
import { downloadDirList, downloadMdxFileOrDirectory } from './github.server'
import { markdownToHtmlUnwrapped, stripHtml } from './markdown.server'
import { formatDate, typedBoolean } from './misc'
import { type Timings } from './timing.server'

type CachifiedOptions = {
	forceFresh?: boolean | string
	request?: Request
	ttl?: number
	timings?: Timings
}

const checkCompiledValue = (value: unknown) =>
	typeof value === 'object' &&
	(value === null || ('code' in value && 'frontmatter' in value))

const defaultTTL = 1000 * 60 * 60 * 24 * 14 // 2 weeks
const defaultStaleWhileRevalidate = 1000 * 60 * 60 * 24 * 365 * 100 // 100 years

// 这个函数的作用是获取mdx页面
export async function getMdxPage(
	{
		contentDir,
		slug,
	}: {
		contentDir: string
		slug: string
	},
	options: CachifiedOptions,
): Promise<MdxPage | null> {
	const { forceFresh, request, ttl = defaultTTL, timings } = options
	const key = `mdx-page:${contentDir}${slug}:compiled`

	const page = await cachified({
		key,
		cache,
		forceFresh,
		request,
		timings,
		ttl,
		staleWhileRevalidate: defaultStaleWhileRevalidate,
		checkValue: checkCompiledValue, //make typescript happy
		getFreshValue: async () => {
			const pageFiles = await downloadMdxFilesCached(contentDir, slug, options)
			const compiledPage = await compileMdxCached({
				contentDir,
				slug,
				...pageFiles,
				options,
			}).catch(err => {
				console.error(`Failed to get a fresh value for mdx:`, {
					contentDir,
					slug,
				})
				return Promise.reject(err)
			})
			return compiledPage
		},
	})
	if (!page) {
		// if there's no page, let's remove it from the cache
		void cache.delete(key)
	}
	return page
}

// 这个主要用来生成siteMap和得到blog列表
export async function getMdxPagesInDirectory(
	contentDir: string,
	options: CachifiedOptions,
) {
	const dirList = await getMdxDirList(contentDir, options)

	// our octokit throttle plugin will make sure we don't hit the rate limit
	const pageDatas = await Promise.all(
		dirList.map(async ({ slug }) => {
			return {
				...(await downloadMdxFilesCached(contentDir, slug, options)),
				slug,
			}
		}),
	)

	const pages = await Promise.all(
		pageDatas.map(pageData =>
			compileMdxCached({ contentDir, ...pageData, options }),
		),
	)
	return pages.filter(typedBoolean)
}

// 获取所有的博客文章，可用于博客首页展示和特定博客下相关博客推荐。
// 相较于getMdxPagesInDirectory函数，多了几个操作：
// 1. 过滤掉draft和unlisted的文章；2. 按照时间排序；3. 只返回frontmatter。
export async function getBlogMdxListItems(options: CachifiedOptions) {
	const { request, forceFresh, ttl = defaultTTL, timings } = options
	const key = 'blog:mdx-list-items'
	return cachified({
		cache,
		request,
		timings,
		ttl,
		staleWhileRevalidate: defaultStaleWhileRevalidate,
		forceFresh,
		key,
		getFreshValue: async () => {
			let pages = await getMdxPagesInDirectory('blog', options).then(allPosts =>
				allPosts.filter(p => !p.frontmatter.draft && !p.frontmatter.unlisted),
			)

			pages = pages.sort((a, z) => {
				const aTime = new Date(a.frontmatter.date ?? '').getTime()
				const zTime = new Date(z.frontmatter.date ?? '').getTime()
				return aTime > zTime ? -1 : aTime === zTime ? 0 : 1
			})

			return pages.map(({ code, ...rest }) => rest)
		},
	})
}

export async function getMdxDirList(
	contentDir: string,
	options?: CachifiedOptions,
) {
	const { forceFresh, ttl = defaultTTL, request, timings } = options ?? {}
	const key = `${contentDir}:dir-list`
	return cachified({
		cache,
		request,
		timings,
		ttl,
		staleWhileRevalidate: defaultStaleWhileRevalidate,
		forceFresh,
		key,
		checkValue: (value: unknown) => Array.isArray(value),
		getFreshValue: async () => {
			const fullContentDirPath = `content/${contentDir}`
			const dirList = (await downloadDirList(fullContentDirPath))
				.map(({ name, path }) => ({
					name,
					slug: path
						.replace(/\\/g, '/')
						.replace(`${fullContentDirPath}/`, '')
						.replace(/\.mdx$/, ''),
				}))
				.filter(({ name }) => name !== 'README.md')
			return dirList
		},
	})
}

async function downloadMdxFilesCached(
	contentDir: string,
	slug: string,
	options: CachifiedOptions,
) {
	const { forceFresh, ttl = defaultTTL, request, timings } = options
	const key = `${contentDir}:${slug}:downloaded`
	const downloaded = await cachified({
		cache,
		request,
		timings,
		ttl,
		staleWhileRevalidate: defaultStaleWhileRevalidate,
		forceFresh,
		key,
		checkValue: (value: unknown) => {
			if (typeof value !== 'object') {
				return `value is not an object`
			}
			if (value === null) {
				return `value is null`
			}

			const download = value as Record<string, unknown>
			if (!Array.isArray(download.files)) {
				return `value.files is not an array`
			}
			if (typeof download.entry !== 'string') {
				return `value.entry is not a string`
			}

			return true
		},
		getFreshValue: async () =>
			downloadMdxFileOrDirectory(`${contentDir}/${slug}`),
	})
	// if there aren't any files, remove it from the cache
	if (!downloaded.files.length) {
		void cache.delete(key)
	}
	return downloaded
}
/**
 *A banner is a prominent image, often displayed at the top of a webpage.
 Banner credit refers to the attribution given to the creator or source of the banner image. e.g. "Photo by John Doe"。Banner alt (alternative text) is a text description of the banner image, used by screen readers. Banner title is a text title associated with the banner image. This title might be displayed as a caption or tooltip when hovering over the image.
 * */
async function compileMdxCached({
	contentDir,
	slug,
	entry,
	files,
	options,
}: {
	contentDir: string
	slug: string
	entry: string
	files: Array<GitHubFile>
	options: CachifiedOptions
}) {
	const key = `${contentDir}:${slug}:compiled`
	const page = await cachified({
		cache,
		ttl: defaultTTL,
		staleWhileRevalidate: defaultStaleWhileRevalidate,
		...options,
		key,
		checkValue: checkCompiledValue,
		getFreshValue: async () => {
			const compiledPage = await compileMdx<MdxPage['frontmatter']>(slug, files)
			if (compiledPage) {
				// 实际上就是写博客的时候，只需提供bannerCloudinaryId。bannerBlurDataUrl可以根据bannerCloudinaryId来生成。
				// bannerBlurDataUrl用来显示模糊的图片，在图片加载完成之前显示。
				if (
					compiledPage.frontmatter.bannerCloudinaryId &&
					!compiledPage.frontmatter.bannerBlurDataUrl
				) {
					try {
						compiledPage.frontmatter.bannerBlurDataUrl = await getBlurDataUrl(
							compiledPage.frontmatter.bannerCloudinaryId,
						)
					} catch (error: unknown) {
						console.error(
							'oh no, there was an error getting the blur image data url',
							error,
						)
					}
				}
				//实际上就是写博客的时候，只需提供bannerCredit。bannerAlt和bannerTitle可以根据bannerCredit来生成。
				if (compiledPage.frontmatter.bannerCredit) {
					const credit = await markdownToHtmlUnwrapped(
						compiledPage.frontmatter.bannerCredit,
					)
					compiledPage.frontmatter.bannerCredit = credit
					const noHtml = await stripHtml(credit)
					if (!compiledPage.frontmatter.bannerAlt) {
						compiledPage.frontmatter.bannerAlt = noHtml
							.replace(/(photo|image)/i, '')
							.trim()
					}
					if (!compiledPage.frontmatter.bannerTitle) {
						compiledPage.frontmatter.bannerTitle = noHtml
					}
				}
				return {
					dateDisplay: compiledPage.frontmatter.date
						? formatDate(compiledPage.frontmatter.date)
						: undefined,
					...compiledPage,
					slug,
					editLink: `https://github.com/kentcdodds/kentcdodds.com/edit/main/${entry}`,
				}
			} else {
				return null
			}
		},
	})
	// if there's no page, remove it from the cache
	if (!page) {
		void cache.delete(key)
	}
	return page
}

// 将图片进行模糊处理后，并转换成data url
async function getBlurDataUrl(cloudinaryId: string) {
	const imageURL = buildImageUrl(cloudinaryId, {
		transformations: {
			resize: { width: 100 },
			quality: 'auto',
			format: 'webp',
			effect: {
				name: 'blur',
				value: '1000',
			},
		},
	})
	const dataUrl = await getDataUrlForImage(imageURL)
	return dataUrl
}

async function getDataUrlForImage(imageUrl: string) {
	const res = await fetch(imageUrl)
	const arrayBuffer = await res.arrayBuffer()
	const base64 = Buffer.from(arrayBuffer).toString('base64')
	const mime = res.headers.get('Content-Type') ?? 'image/webp'
	const dataUrl = `data:${mime};base64,${base64}`
	return dataUrl
}
