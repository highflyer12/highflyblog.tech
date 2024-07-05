import { type TypedResponse, type MetaFunction } from '@remix-run/node'
import { LRUCache } from 'lru-cache'
import { getMDXComponent } from 'mdx-bundler/client'
import React from 'react'
import { type MdxPage } from '../../types'
import { getSocialImageWithPreTitle } from '../images'
import { type RootLoaderType } from '../root'
import { getDisplayUrl, getUrl, typedBoolean } from './misc'
import { getSocialMetas } from './seo'

function getBannerAltProp(frontmatter: MdxPage['frontmatter']) {
	return (
		frontmatter.bannerAlt ??
		frontmatter.bannerTitle ??
		frontmatter.bannerCredit ??
		frontmatter.title ??
		'Post banner'
	)
}

function getBannerTitleProp(frontmatter: MdxPage['frontmatter']) {
	return (
		frontmatter.bannerTitle ?? frontmatter.bannerAlt ?? frontmatter.bannerCredit
	)
}

type ExtraMeta = Array<{ [key: string]: string }> // an array of meta objects

type MetaLoader = () => Promise<
	TypedResponse<{
		page: MdxPage
	}>
>

// this is the meta function for blog MDX page. 【也就是就需要code生成component，也需要配套的meta】
/** 关于meta函数：
make all loader's data type safe.
第一个参数是当前 route 的类型，第二个参数是一个对象，以「match id:type of loader」的形式给出所有match routes 的 loader 类型。
MetaFunction<
	typeof loader,
	{ 'routes/project/$pid': typeof projectDetailsLoader }>
*/
const mdxPageMeta: MetaFunction<MetaLoader, { root: RootLoaderType }> = ({
	data,
	matches,
}) => {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	const requestInfo = matches.find(m => m.id === 'root')?.data.requestInfo
	if (data?.page) {
		// NOTE: keyword metadata is not used because it was used and abused by
		// spammers. We use them for sorting on our own site, but we don't list
		// it in the meta tags because it's possible to be penalized for doing so.
		const { keywords, ...extraMetaInfo } = data.page.frontmatter.meta ?? {} // keyword metadata is not used
		// reduce函数用法：reduce(callbackFn) reduce(callbackFn, initialValue)
		// callbackFn写法：写出旧accumulator与当前value，如何形成新accumulator.
		const extraMeta: ExtraMeta = Object.entries(extraMetaInfo).reduce(
			(acc: ExtraMeta, [key, val]) => [...acc, { [key]: String(val) }],
			[],
		)

		let title = data.page.frontmatter.title
		const isDraft = data.page.frontmatter.draft
		const isUnlisted = data.page.frontmatter.unlisted
		if (isDraft) title = `(DRAFT) ${title ?? ''}`

		return [
			isDraft || isUnlisted ? { robots: 'noindex' } : null,
			...getSocialMetas({
				title,
				description: data.page.frontmatter.description,
				url: getUrl(requestInfo),
				image: getSocialImageWithPreTitle({
					url: getDisplayUrl(requestInfo),
					featuredImage:
						data.page.frontmatter.bannerCloudinaryId ??
						'kentcdodds.com/illustrations/kody-flying_blue',
					title:
						data.page.frontmatter.socialImageTitle ??
						data.page.frontmatter.title ??
						'Untitled',
					preTitle:
						data.page.frontmatter.socialImagePreTitle ??
						`Check out this article`,
				}),
			}),
			...extraMeta,
		].filter(typedBoolean)
	} else {
		return [
			{ title: 'Not found' },
			{
				description:
					'You landed on a page that Kody the Coding Koala could not find 🐨😢',
			},
		]
	}
}

// This exists so we don't have to call new Function for the given code
// for every request for a given blog post/mdx file.
const mdxComponentCache = new LRUCache<
	string,
	ReturnType<typeof getMDXComponent>
>({
	max: 1000,
})

function useMdxComponent(code: string) {
	return React.useMemo(() => {
		if (mdxComponentCache.has(code)) {
			return mdxComponentCache.get(code)!
		}
		const component = getMDXComponent(code)
		mdxComponentCache.set(code, component)
		return component
	}, [code])
}

export { getBannerAltProp, getBannerTitleProp, mdxPageMeta, useMdxComponent }
