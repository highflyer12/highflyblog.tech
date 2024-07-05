// 与博客相关，但更加通用的工具函数【关于search、filter、rank】
import { matchSorter, rankings as matchSorterRankings } from 'match-sorter'
import { type MdxListItem } from '#types'
import { type ReadRankings } from './blog.server'

/**
 * matchSorter: filter and sort a list of items based on given input!
 * filter以及排序标准: 默认情况下，matchSorter将使用以下标准进行过滤：
 *  CASE_SENSITIVE_EQUAL: 7;
    EQUAL: 6;
    STARTS_WITH: 5;
    WORD_STARTS_WITH: 4;
    CONTAINS: 3;
    ACRONYM: 2;
    MATCHES: 1;
    NO_MATCH: 0;
    也就是说：如果不规定threshold，那么默认的排序规则是：完全匹配 > 首字母匹配 > 包含匹配 > 首字母缩写匹配 > 包含缩写匹配 > 同序匹配 > 无匹配。【即会返回全部的原始数据，只根据匹配进行排序】
    可以通过options，threshold对特定的key规定过滤规则，threshold的值可以是上面的7个值之一。
    还可以通过maxRanking对特定的key规定排序规则，对特定的匹配方式提升排序等级。
 */
export function filterPosts(posts: Array<MdxListItem>, searchString: string) {
	if (!searchString) return posts

	const options = {
		// 因为是在array of objects中进行搜索searchString，所以需要指定keys【在哪些keys中查询匹配】，threshold指定至少要达到的匹配标准。
		keys: [
			{
				key: 'frontmatter.title',
				threshold: matchSorterRankings.CONTAINS,
			},
			{
				key: 'frontmatter.categories',
				threshold: matchSorterRankings.CONTAINS,
				maxRanking: matchSorterRankings.CONTAINS,
			},
			{
				key: 'frontmatter.meta.keywords',
				threshold: matchSorterRankings.CONTAINS,
				maxRanking: matchSorterRankings.CONTAINS,
			},
			{
				key: 'frontmatter.description',
				threshold: matchSorterRankings.CONTAINS,
				maxRanking: matchSorterRankings.CONTAINS,
			},
		],
	}

	const allResults = matchSorter(posts, searchString, options)
	const searches = new Set(searchString.split(' '))
	if (searches.size < 2) {
		// if there's only one word then we're done
		return allResults
	}

	// if there are multiple words, we'll conduct an individual search for each word
	const [firstWord, ...restWords] = searches.values()
	if (!firstWord) {
		// this should be impossible, but if it does happen, we'll just return an empty array
		return []
	}
	const individualWordOptions = {
		...options,
		keys: options.keys.map(key => {
			return {
				...key,
				maxRanking: matchSorterRankings.CASE_SENSITIVE_EQUAL,
				threshold: matchSorterRankings.WORD_STARTS_WITH,
			}
		}),
	}

	// go through each word and further filter the results
	let individualWordResults = matchSorter(
		posts,
		firstWord,
		individualWordOptions,
	)
	for (const word of restWords) {
		const searchResult = matchSorter(
			individualWordResults,
			word,
			individualWordOptions,
		)
		individualWordResults = individualWordResults.filter(r =>
			searchResult.includes(r),
		)
	}
	//搜索匹配的结果包括两种情况：1.包含（即searchTerm连续的匹配）2.searchTerm的每个单词均可离散的startWith匹配
	return Array.from(new Set([...allResults, ...individualWordResults]))
}

// 获取近期人均阅读量最高的Team。【既然如此，那要percent干嘛】
export function getRankingLeader(rankings?: ReadRankings) {
	if (!rankings) return null

	return rankings.reduce((leader: ReadRankings[number] | null, rank) => {
		if (rank.ranking <= 0) return leader
		if (!leader || rank.ranking > leader.ranking) return rank
		return leader
	}, null)
}
