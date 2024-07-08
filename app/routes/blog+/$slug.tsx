import {
	type HeadersFunction,
	json,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { useLoaderData, useMatches, useParams } from '@remix-run/react'
import React from 'react'
import { type MdxListItem, type Team } from '../../../types'
import { BackLink } from '../../components/arrow-button'
import { Grid } from '../../components/grid'
import { H2, H6 } from '../../components/typography'
import { getRankingLeader } from '../../utils/blog'
import {
	getBlogReadRankings,
	getBlogRecommendations,
	getTotalPostReads,
	type ReadRankings,
} from '../../utils/blog.server'
import { mdxPageMeta, useMdxComponent } from '../../utils/mdx'
import { getMdxPage } from '../../utils/mdx.server'
import {
	formatNumber,
	requireValidSlug,
	reuseUsefulLoaderHeaders,
} from '../../utils/misc'
import { getServerTimeHeader } from '../../utils/timing.server'
import { useRootData } from '../../utils/use-root-data'
import { markAsRead } from '../action+/mark-as-read'
import { Sidebar } from '../../components/sidebar'

type CatchData = {
	recommendations: Array<MdxListItem>
	readRankings: ReadRankings
	totalReads: string
	leadingTeam: Team | null
}

export default function BlogPostScreen() {
	const data = useLoaderData<typeof loader>()
	const { requestInfo } = useRootData()

	const { code, dateDisplay, frontmatter, toc } = data.page
	// console.log('toc', toc)
	const params = useParams()
	const { slug } = params
	const Component = useMdxComponent(code)

	// generate breadcrumbs
	const matches = useMatches()
	console.log('matches', matches)

	const readMarker = React.useRef<HTMLDivElement>(null) // 后面会有<main ref={readMarker}>
	const isDraft = Boolean(data.page.frontmatter.draft)
	const isArchived = Boolean(data.page.frontmatter.archived)

	useOnRead({
		parentElRef: readMarker,
		time: data.page.readTime?.time,
		onRead: React.useCallback(() => {
			if (isDraft) return
			if (slug) void markAsRead({ slug })
		}, [isDraft, slug]),
	})

	return (
		<>
			<Grid className="mb-10 mt-24 lg:mb-24">
				<div className="col-span-full flex justify-between lg:col-span-8 lg:col-start-3">
					<BackLink to="/">Back to home</BackLink>
				</div>
			</Grid>

			<Grid as="header" className="mb-12">
				<div className="col-span-full lg:col-span-8 lg:col-start-3">
					{isDraft ? (
						<div className="prose-light dark:prose-dark prose mb-6 max-w-full">
							{React.createElement(
								'callout-warning',
								{},
								`This blog post is a draft. Please don't share it in its current state.`,
							)}
						</div>
					) : null}
					{isArchived ? (
						<div className="prose-light dark:prose-dark prose mb-6 max-w-full">
							{React.createElement(
								'callout-warning',
								{},
								`This blog post is archived. It's no longer maintained and may contain outdated information.`,
							)}
						</div>
					) : null}
					<H2>{frontmatter.title}</H2>
					<H6 as="p" variant="secondary" className="mt-2">
						{[dateDisplay, data.page.readTime?.text ?? 'quick read']
							.filter(Boolean)
							.join(' — ')}
					</H6>
				</div>
			</Grid>
			<div className="flex justify-between">
				<div className="prose-light dark:prose-dark prose mb-24 break-words">
					<main className="ml-8">
						<Component />
					</main>
				</div>
				<Sidebar toc={toc} />
			</div>
		</>
	)
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	requireValidSlug(params.slug)
	const timings = {}

	const slug = params.slug as string
	const page = await getMdxPage(
		{ contentDir: 'blog', slug },
		{ request, timings },
	)

	// * Promise.all() allows the promises to run in parallel, while separate await statements run the promises in sequence.【即Promise.all()有性能上的优势】
	const [recommendations, readRankings, totalReads] = await Promise.all([
		getBlogRecommendations({
			request,
			timings,
			limit: 3,
			keywords: [
				...(page?.frontmatter.categories ?? []),
				...(page?.frontmatter.meta?.keywords ?? []),
			],
			excludes: [params.slug],
		}),
		getBlogReadRankings({ request, slug: params.slug, timings }),
		getTotalPostReads({ request, slug: params.slug, timings }),
	])

	const catchData: CatchData = {
		recommendations,
		readRankings,
		totalReads: formatNumber(totalReads),
		leadingTeam: getRankingLeader(readRankings)?.team ?? null,
	}
	const headers = {
		'Cache-Control': 'private, max-age=3600', // tells the client that the response can be cached, but only for private use (typically in the user's browser), and not by a shared cache (like a CDN).
		Vary: 'Cookie', // tells the cache that the response may be different if the 'Cookie' header in the request changes, If the 'Cookie' header changes, the cache should not use the cached response and should instead make a new request
		'Server-Timing': getServerTimeHeader(timings), // useful for performance analysis, as it allows the client to see how much time various server-side operations took.
	}
	if (!page) {
		throw json(catchData, { status: 404, headers })
	}
	const data = {
		page,
		...catchData,
	}
	return json(data, { status: 200, headers })
}

export const meta = mdxPageMeta

export const headers: HeadersFunction = reuseUsefulLoaderHeaders

// triggers a callback (onRead) when a certain element (插入到博文最底部的div) has been in the viewport and we have spent a certain amount of time on the page.
function useOnRead({
	parentElRef,
	time,
	onRead,
}: {
	parentElRef: React.RefObject<HTMLElement>
	time: number | undefined
	onRead: () => void
}) {
	React.useEffect(() => {
		/**
		 * 我们用IntersectionObserver来判断博客内容部分parentEl是否完成了滚动【也就是是否滚到底了】，因此很自然的实现就是，在parentEl的底部添加一个div【visibilityEl】，然后用IntersectionObserver来监听这个div是否进入了视图。
		 */
		const parentEl = parentElRef.current
		if (!parentEl || !time) return

		const visibilityEl = document.createElement('div')

		let scrolledTheMain = false
		// refer: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
		// * options没有定义，所以root默认是viewport，因此entry.isIntersecting就相当于判断visibilityEl是否进入了viewport。【threshold default===0，所以只要target有一点点进入视图即可，这也确实表面main滚动完了】
		// !注意：IntersectionObserver的callback在进入或者退出时都会被call，因此callback内部一定要有类似于entry.isIntersecting的逻辑判断。
		// * The observer may be observing multiple elements whose intersection could change at the same time, so the callback is passed an array of elements。【If the observer is only observing a single image element, then the array only has one element.】
		const observer = new IntersectionObserver(entries => {
			const isVisible = entries.some(entry => {
				return entry.target === visibilityEl && entry.isIntersecting
			})
			if (isVisible) {
				scrolledTheMain = true
				maybeMarkAsRead()
				observer.disconnect()
				visibilityEl.remove()
			}
		})

		let startTime = new Date().getTime()
		let timeoutTime = time * 0.6 // 这里认为只要用户在这停留大于0.6倍预估阅读时间，就算阅读了
		let timerId: ReturnType<typeof setTimeout>
		let timerFinished = false
		function startTimer() {
			timerId = setTimeout(() => {
				timerFinished = true
				document.removeEventListener('visibilitychange', handleVisibilityChange)
				maybeMarkAsRead()
			}, timeoutTime)
		}

		// 处理用户切换tab、最小化浏览器窗口或者浏览器没有focus等的情况。这些情况下，我们需要暂停计时器。【这里暂停计时器的方法是，从总时间中减去已经花掉的时间，重开一个新的计时器】
		function handleVisibilityChange() {
			if (document.hidden) {
				// If document.hidden returns true, it means that the page is not visible to the user. This can happen if the user has switched to a different tab, the browser window is minimized, the browser is not in focus, or the screen is locked.
				clearTimeout(timerId)
				const timeElapsedSoFar = new Date().getTime() - startTime
				timeoutTime = timeoutTime - timeElapsedSoFar
			} else {
				startTime = new Date().getTime()
				startTimer()
			}
		}

		// 这个函数在IntersectionObserver的callback中，以及startTimer中各调用一次，但是因为if (timerFinished && scrolledTheMain)，onread()只可能被调用一次。
		function maybeMarkAsRead() {
			if (timerFinished && scrolledTheMain) {
				cleanup()
				onRead()
			}
		}

		// dirty-up
		parentEl.append(visibilityEl)
		// * Tell the observer what element to watch by calling observe on the observer object. This starts watching the element.
		observer.observe(visibilityEl)
		startTimer()
		document.addEventListener('visibilitychange', handleVisibilityChange)

		function cleanup() {
			document.removeEventListener('visibilitychange', handleVisibilityChange)
			clearTimeout(timerId)
			observer.disconnect()
			visibilityEl.remove()
		}
		return cleanup
	}, [time, onRead, parentElRef])
}
