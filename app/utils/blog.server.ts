// 一些与博客相关的工具函数，比如获取推荐博客、获取博客阅读量等等
import { subMonths, subYears } from 'date-fns'
import { type Team, type MdxListItem, type Await } from '#types'
import { filterPosts } from './blog'
import { cache, cachified, lruCache } from './cache.server.ts'
import { shuffle } from './cjs/lodash.js'
import { getClientSession } from './client.server'
import { prisma } from './db.server'
import { getBlogMdxListItems } from './mdx.server'
import {
	getDomainUrl,
	typedBoolean,
	teams,
	getRequiredServerEnvVar,
	getOptionalTeam,
} from './misc.tsx'
import { getSession, getUser } from './session.server'
import { time, type Timings } from './timing.server'
import { User } from '@prisma/client'
import { teamEmoji } from './team-provider.tsx'
import { sendMessageFromDiscordBot } from './discord.server.ts'

export async function getBlogRecommendations({
	request,
	limit = 3,
	keywords = [],
	excludes: externalExclude = [],
	timings,
}: {
	request: Request
	limit?: number | null
	keywords?: Array<string>
	excludes?: Array<string>
	timings?: Timings
}) {
	const allPosts = await getBlogMdxListItems({ request, timings })

	// recommendation posts = exclude what they want us to exclude(externalExclude) + any posts that are labeled as archived or draft from the mostPopular()
	let exclude = Array.from(
		new Set([
			...externalExclude,
			...allPosts
				.filter(
					post =>
						post.frontmatter.unlisted ??
						post.frontmatter.archived ??
						post.frontmatter.draft,
				)
				.map(post => post.slug),
		]),
	)
	// filter out what user've already read
	// 先获取读者的标识【登录user，未登录的话clientId】，然后从数据库中查询标识读过的博客。【数据库记录每个client和user的读过的博客】
	const session = await getSession(request)
	const user = await session.getUser()
	const client = await getClientSession(request, user)
	const clientId = client.getClientId()

	const whereCondition = user
		? {
				userId: user.id,
				postSlug: { notIn: exclude.filter(Boolean) }, // 已经被排除的就没必要在查询了，免得出现重复值
			}
		: {
				clientId,
				postSlug: { notIn: exclude.filter(Boolean) },
			}
	// exclude posts that the user or this client has already read
	const readPosts = await time(
		prisma.postRead.groupBy({
			by: ['postSlug'],
			where: whereCondition,
		}),
		{
			timings,
			type: 'getReadPosts',
			desc: 'getting slugs of all posts read by user',
		},
	)
	exclude.push(...readPosts.map(post => post.postSlug))

	// 到此，exclude构建完成, 从allPosts中过滤掉exclude中的slug得到潜在的推荐博客
	const recommendablePosts = allPosts.filter(
		post => !exclude.includes(post.slug),
	)

	/**!接下来就是推荐算法的核心部分了！
	 * 有三种推荐方式：1是most relevant，根据关键字匹配最相关的【需要有提供关键字才行】；2是most popular，根据阅读量最多的；3是完全随机推荐。
	 */
	// 当然，如果推荐不限制数量，那么直接返回所有的推荐博客【顺序打乱】
	if (!limit) return shuffle(recommendablePosts)

	// if no keywords were given, then we won't have a group for best match
	// so there will only be two groups
	const groupsCount = keywords.length ? 3 : 2
	const limitPerGroup = Math.floor(limit / groupsCount) || 1 // 每组至少一个
	const recommendations: Array<MdxListItem> = []

	// 1. most relevant: get best match posts
	if (keywords.length) {
		const postsByBestMatch = Array.from(
			new Set(
				...keywords.map(keyword => filterPosts(recommendablePosts, keyword)),
			),
		)
		const bestMatchRecommendations = shuffle(
			// takes the first limitPerGroup * 4 posts from postsByBestMatch
			postsByBestMatch.slice(0, limitPerGroup * 4),
		).slice(0, limitPerGroup)
		recommendations.push(...bestMatchRecommendations)
		exclude.push(...exclude, ...bestMatchRecommendations.map(post => post.slug))
	}
	// 2. get most popular posts
	const mostPopularRecommendationSlugs = await getMostPopularPostSlugs({
		// get 4x the limit so we can have a little randomness
		limit: limitPerGroup * 4,
		exclude,
		timings,
		request,
	})
	const mostPopularRecommendations = shuffle(
		mostPopularRecommendationSlugs
			.map(slug => recommendablePosts.find(p => p.slug === slug))
			.filter(typedBoolean),
	).slice(0, limitPerGroup)
	recommendations.push(...mostPopularRecommendations)
	exclude = [...exclude, ...mostPopularRecommendationSlugs]

	// 3. get random posts [if we still need more]
	if (recommendations.length < limit) {
		const remainningRecommendablePosts = recommendablePosts.filter(
			post => !exclude.includes(post.slug),
		)
		const randomRecommendations = shuffle(remainningRecommendablePosts).slice(
			0,
			limit - recommendations.length,
		)
		recommendations.push(...randomRecommendations)
	}
	// then mix them up
	return shuffle(recommendations)
}

async function getMostPopularPostSlugs({
	limit,
	exclude,
	timings,
	request,
}: {
	limit: number
	exclude: Array<string>
	timings?: Timings
	request: Request
}) {
	const postsSortedByMostPopular = await cachified({
		key: 'sorted-most-popular-post-slugs',
		ttl: 1000 * 60 * 30,
		staleWhileRevalidate: 1000 * 60 * 60 * 24,
		cache: lruCache, // 这里用的是lruCache，因为热门blog可能会经常变化，所以不适合用sqlite
		request, // 这个是用来根据请求身份，判断是否可以强制刷新的【await getUser(request))?.role !== 'ADMIN'】
		getFreshValue: async () => {
			const result = await prisma.postRead.groupBy({
				by: 'postSlug',
				// asking Prisma to count the number of rows in each group.
				_count: true,
				// ordering the groups by the count of postSlug in descending order.
				orderBy: {
					_count: {
						postSlug: 'desc',
					},
				},
			})
			return result.map(p => p.postSlug)
		},
		timings,
		checkValue: (value: unknown) =>
			Array.isArray(value) && value.every(v => typeof v === 'string'),
	})
	// NOTE: we're not using exclude and limit in the query itself because it's
	// a slow query and quite hard to cache. It's not a lot of data that's returned
	// anyway, so we can easily filter it out here.
	return postsSortedByMostPopular
		.filter(s => !exclude.includes(s))
		.slice(0, limit)
}

// get the number of reads for specific post or all posts
export async function getTotalPostReads({
	request,
	slug,
	timings,
}: {
	request: Request
	slug?: string
	timings?: Timings
}) {
	const key = `total-post-reads:${slug ?? '__all-posts__'}`
	return await cachified({
		key,
		request,
		ttl: 1000 * 60,
		staleWhileRevalidate: 1000 * 60 * 60 * 24,
		cache: lruCache,
		timings,
		getFreshValue: async () =>
			prisma.postRead.count(slug ? { where: { postSlug: slug } } : undefined),
		checkValue: (value: unknown) => typeof value === 'number',
	})
}

// get the number of unique readers for the entire site
export async function getReaderCount({
	request,
	timings,
}: {
	request: Request
	timings?: Timings
}) {
	return cachified({
		key: 'reader-count',
		request,
		ttl: 1000 * 60,
		staleWhileRevalidate: 1000 * 60 * 60 * 24,
		cache: lruCache,
		timings,
		getFreshValue: async () => {
			const result = prisma.$queryRaw`
            SELECT 
            (SELECT COUNT(DISTINCT "userId") FROM "PostRead" WHERE "userId" IS NOT NULL) +
             (SELECT COUNT(DISTINCT "clientId") FROM "PostRead" WHERE "clientId" IS NOT NULL) `
			if (!isRawQueryResult(result)) {
				console.error(`Unexpected result from getReaderCount: ${result}`)
				return 0
			}
			// Object.values就是把对象的values取出来，然后组成一个数组
			const count = Object.values(result[0] ?? [])[0] ?? 0
			// the count is a BigInt, so we need to convert it to a number
			return Number(count)
		},
	})
}

// get the number of reads for a specific post by a specific team in the last 6 months
export async function getRecentReads({
	slug,
	team,
	timings,
}: {
	slug: string | undefined
	team: Team
	timings?: Timings
}) {
	const withinTheLastSixMonths = subMonths(new Date(), 6)

	const count = await time(
		prisma.postRead.count({
			where: {
				postSlug: slug,
				createdAt: { gt: withinTheLastSixMonths },
				user: { team },
			},
		}),
		{
			timings,
			type: 'getRecentReads',
			desc: `Getting reads of ${slug} by ${team} within the last 6 months`,
		},
	)
	return count
}

// get the number of active members in a team 【active: the user has read some blog in the last year】
export async function getActiveMembers({
	team,
	timings,
}: {
	team: Team
	timings?: Timings
}) {
	const withinTheLastYear = subYears(new Date(), 1)

	const count = await time(
		prisma.user.count({
			where: {
				team,
				postReads: {
					some: {
						createdAt: { gt: withinTheLastYear },
					},
				},
			},
		}),
		{
			timings,
			type: 'getActiveMembers',
			desc: `Getting active members of ${team}`,
		},
	)

	return count
}

// 获取client或者user读过的所有博客的slug
export async function getSlugReadsByUser({
	request,
	timings,
}: {
	request: Request
	timings?: Timings
}) {
	const user = await getUser(request)
	const clientSession = await getClientSession(request, user)
	const clientId = clientSession.getClientId()
	const reads = await time(
		prisma.postRead.findMany({
			where: user ? { userId: user.id } : { clientId },
			select: { postSlug: true },
		}),
		{
			timings,
			type: 'getSlugReadsByUser',
			desc: `Getting reads by ${user ? user.id : clientId}`,
		},
	)
	return Array.from(new Set(reads.map(read => read.postSlug)))
}

// In many SQL libraries, a raw query result from a SELECT operation is an array of objects where each object represents a row from the result set.
function isRawQueryResult(
	result: any,
): result is Array<Record<string, unknown>> {
	return Array.isArray(result) && result.every(r => typeof r === 'object')
}

// 给出特定blog或者所有blog的Team阅读排名，依据是getRecentReads/getActiveMembers【近期总阅读量/近期活跃用户】，并且进行一定程度normalize【最大最小值归一化】
// 返回{team,totalReads,ranking,percent}[]（rankingObj），并且按照percent排序
export async function getBlogReadRankings({
	slug,
	request,
	forceFresh,
	timings,
}: {
	slug?: string
	request?: Request
	forceFresh?: boolean
	timings?: Timings
}) {
	const key = slug ? `blog:${slug}:rankings` : `blog:rankings`
	const rankingObjs = await cachified({
		key,
		cache,
		request,
		timings,
		ttl: slug ? 1000 * 60 * 60 * 24 * 7 : 1000 * 60 * 60,
		staleWhileRevalidate: 1000 * 60 * 60 * 24,
		forceFresh,
		checkValue: (value: unknown) =>
			Array.isArray(value) &&
			value.every(v => typeof v === 'object' && 'team' in v!),
		getFreshValue: async () => {
			const rawRankingData = await Promise.all(
				teams.map(async function getRankingsForTeam(team): Promise<{
					team: Team
					totalReads: number
					ranking: number
				}> {
					const totalReads = await prisma.postRead.count({
						where: {
							postSlug: slug,
							user: { team },
						},
					})
					const activeMembers = await getActiveMembers({ team, timings })
					const recentReads = await getRecentReads({ slug, team, timings })
					let ranking = 0
					if (activeMembers) {
						ranking = Number((recentReads / activeMembers).toFixed(4))
					}
					return { team, totalReads, ranking }
				}),
			)
			const rankings = rawRankingData.map(r => r.ranking)
			const maxRanking = Math.max(...rankings)
			const minRanking = Math.min(...rankings)
			const rankPercentages = rawRankingData.map(
				({ team, totalReads, ranking }) => {
					return {
						team,
						totalReads,
						ranking,
						percent: Number(
							((ranking - minRanking) / (maxRanking - minRanking || 1)).toFixed(
								2,
							),
						),
					}
				},
			)

			return rankPercentages
		},
	})
	return (
		rankingObjs
			// if they're the same, then we'll randomize their relative order.
			// Otherwise, it's greatest to smallest
			.sort(({ percent: a }, { percent: b }) =>
				b === a ? (Math.random() > 0.5 ? -1 : 1) : a > b ? -1 : 1,
			)
	)
}

export type ReadRankings = Await<ReturnType<typeof getBlogReadRankings>>

// 用于访问https://kentcdodds.com/blog.json#/时展示网站的所有blog的json数据
export async function getBlogJson(request: Request) {
	const posts = await getBlogMdxListItems({ request })
	const blogUrl = `${getDomainUrl(request)}/blog`
	return posts.map(post => {
		const {
			slug,
			frontmatter: {
				title,
				description,
				categories,
				meta: { keywords = [] } = {},
			},
		} = post
		return {
			id: slug,
			slug,
			productionUrl: `${blogUrl}/${slug}`,
			title,
			categories,
			keywords,
			description,
		}
	})
}

const leaderboardChannelId = getRequiredServerEnvVar(
	'DISCORD_LEADERBOARD_CHANNEL',
)
const getUserDiscordMention = (user: User) =>
	user.discordId ? `<@!${user.discordId}>` : user.name ?? user.username

export async function notifyOfTeamLeaderChangeOnPost({
	request,
	prevLeader,
	newLeader,
	postSlug,
	reader,
}: {
	request: Request
	prevLeader?: Team
	newLeader: Team
	postSlug: string
	reader: User | null
}) {
	const blogUrl = `${getDomainUrl(request)}/blog`
	const newLeaderEmoji = teamEmoji[newLeader]
	const url = `${blogUrl}/${postSlug}`
	const newTeamMention = `the ${newLeaderEmoji} ${newLeader.toLowerCase()} team`
	if (prevLeader) {
		const prevLeaderEmoji = teamEmoji[prevLeader]
		const prevTeamMention = `the ${prevLeaderEmoji} ${prevLeader.toLowerCase()} team`
		if (reader && reader.team === newLeader) {
			const readerMention = getUserDiscordMention(reader)
			const cause = `${readerMention} just read ${url} and won the post from ${prevTeamMention} for ${newTeamMention}!` // e.g. @highfly 🌌 just read https://kentcdodds.com/blog/how-to-use-react-context-effectively and won the post from the 🟡 yellow team for the 🔵 blue team!
			await sendMessageFromDiscordBot(
				leaderboardChannelId,
				`🎉 Congratulations to ${newTeamMention}! You've won a post!\n\n${cause}`,
			) // 消息发送到discord的epicweb server的leaderboard频道
		} else {
			const who = reader
				? `Someone on the ${
						teamEmoji[getOptionalTeam(reader.team)]
					} ${reader.team.toLowerCase()} team`
				: `An anonymous user`
			const cause = `${who} just read ${url} and triggered a recalculation of the rankings: ${prevTeamMention} lost the post and it's now claimed by ${newTeamMention}!`
			await sendMessageFromDiscordBot(
				leaderboardChannelId,
				`🎉 Congratulations to ${newTeamMention}! You've won a post!\n\n${cause}`,
			)
		}
	} else if (reader) {
		const readerMention = getUserDiscordMention(reader)
		await sendMessageFromDiscordBot(
			leaderboardChannelId,
			`Congratulations to ${newTeamMention}! You've won a post!\n\n${readerMention} just read ${url} and claimed the post for ${newTeamMention}!`,
		)
	}
}

export async function notifyOfOverallTeamLeaderChange({
	request,
	prevLeader,
	newLeader,
	postSlug,
	reader,
}: {
	request: Request
	prevLeader?: Team
	newLeader: Team
	postSlug: string
	reader: User | null
}) {
	const blogUrl = `${getDomainUrl(request)}/blog`
	const newLeaderEmoji = teamEmoji[newLeader]
	const url = `${blogUrl}/${postSlug}`

	const cause = reader
		? `${getUserDiscordMention(reader)} just read ${url}`
		: `An anonymous user just read ${url} triggering a ranking recalculation`

	if (prevLeader) {
		const prevLeaderEmoji = teamEmoji[prevLeader]
		await sendMessageFromDiscordBot(
			leaderboardChannelId,
			`🎉 Congratulations to the ${newLeaderEmoji} ${newLeader.toLowerCase()} team! ${cause} and knocked team ${prevLeaderEmoji} ${prevLeader.toLowerCase()} team off the top of the leader board! 👏`,
		)
	} else {
		await sendMessageFromDiscordBot(
			leaderboardChannelId,
			`🎉 Congratulations to the ${newLeaderEmoji} ${newLeader.toLowerCase()} team! ${cause} and took ${newLeader.toLowerCase()} team to the top of the leader board! 👏`,
		)
	}
}
