/* eslint-disable import/no-duplicates */
import fs from 'fs'
import {
	type Cache,
	cachified as baseCachified,
	verboseReporter,
	type CacheEntry,
	type Cache as CachifiedCache,
	type CachifiedOptions,
	totalTtl,
} from '@epic-web/cachified'
import { remember } from '@epic-web/remember'
import type BetterSqlite3 from 'better-sqlite3'
import Database from 'better-sqlite3'
import { getInstanceInfo, getInstanceInfoSync } from 'litefs-js'
import { LRUCache } from 'lru-cache'
import { updatePrimaryCacheValue } from '#app/routes/resources+/cache.sqlite.ts'
import { getRequiredServerEnvVar } from './misc.tsx'
import { getUser } from './session.server.ts'
import { time, type Timings } from './timing.server.ts'

// getRequiredServerEnvVar可以根据需要的env变量名获取env变量的值，在dev环境中，会给与默认值，因此env中可以没有这个变量
const CACHE_DATABASE_PATH = getRequiredServerEnvVar('CACHE_DATABASE_PATH')

// remember basically is a type-safe singleton implementation.
// usage: export const prisma = remember('prisma', () => new PrismaClient())
// 这里用来创建一个sqlite数据库实例---单例模式！这个sqlite数据库用来作为persistent cache[data will persist across server restarts]. useful for data that doesn't change often and is expensive to compute or retrieve, such as data fetched from a remote API.【比如从github获取mdxPage和从twitter获取相关数据都用的是数据库缓存。】
const cacheDb = remember('cacheDb', createDatabase)

function createDatabase(tryAgain = true): BetterSqlite3.Database {
	const db = new Database(CACHE_DATABASE_PATH) // Creates a new database connection. If the database file does not exist, it is created.
	const { currentIsPrimary } = getInstanceInfoSync()
	if (!currentIsPrimary) return db

	try {
		// create cache table with metadata JSON column and value JSON column if it does not exist already
		db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        metadata TEXT,
        value TEXT
      )
    `)
	} catch (error: unknown) {
		fs.unlinkSync(CACHE_DATABASE_PATH)
		if (tryAgain) {
			console.error(
				`Error creating cache database, deleting the file at "${CACHE_DATABASE_PATH}" and trying again...`,
			)
			return createDatabase(false)
		}
		throw error
	}
	return db
}

const lruInstance = remember(
	'lru-cache',
	() => new LRUCache<string, CacheEntry<unknown>>({ max: 5000 }),
)

// In-memory cache. Stores data in the server's memory and uses a Least Recently Used (LRU) eviction strategy. faster than a SQLite-based cache. useful for data that is accessed frequently and changes often, or for caching expensive computations that are specific to a particular server session.
// LRU cache is specific to each instance. So no need to worry about cache consistency across multiple instances.【所以无需判断是否是primary instance】
// 注意，cachified支持多种底层cache实例【且不在乎底层具体是什么cache实例】，比如lruCache和sqlite等等，而实现此功能的方法便是，【根据具体的cache实例，构建满足Cache接口的相关函数——set、get、delete】
export const lruCache = {
	set(key, value) {
		const ttl = totalTtl(value.metadata)
		return lruInstance.set(key, value, {
			ttl: ttl === Infinity ? undefined : ttl,
			start: value.metadata.createdTime,
		})
	},
	get(key) {
		return lruInstance.get(key)
	},
	delete(key) {
		return lruInstance.delete(key)
	},
} satisfies Cache

// prepare statement是sql的专业术语，表示带有表量的预编译query语句，可以提高查询效率。用？表示占位符，然后在执行时绑定具体的值。
const preparedGet = cacheDb.prepare(
	'SELECT value, metadata FROM cache WHERE key = ?',
)
const preparedSet = cacheDb.prepare(
	'INSERT OR REPLACE INTO cache (key, value, metadata) VALUES (@key, @value, @metadata)',
)
const preparedDelete = cacheDb.prepare('DELETE FROM cache WHERE key = ?')

export const cache: CachifiedCache = {
	name: 'SQLite cache',
	get(key) {
		// .get return only the first matching row
		const result = preparedGet.get(key) as any // TODO: fix this with zod or something
		if (!result) return null
		return {
			metadata: JSON.parse(result.metadata),
			value: JSON.parse(result.value),
		} as any // TODO: fix this with zod or something
	},
	// The primary instance is the main instance that handles write operations;responsible for maintaining the "source of truth" state of the system.【By designating one instance as the primary, you can ensure that all write operations go through a single point, which can help maintain consistency.】
	// Secondary instances, typically used to handle read operations. They often replicate the state of the primary instance to ensure data consistency across the system.
	// If the current instance is not the primary, it sends a request to update the cache on the primary instance.
	async set(key, entry) {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		const { currentIsPrimary, primaryInstance } = await getInstanceInfo()
		if (currentIsPrimary) {
			preparedSet.run({
				key,
				value: JSON.stringify(entry.value),
				metadata: JSON.stringify(entry.metadata),
			})
		} else {
			// fire-and-forget cache update
			void updatePrimaryCacheValue!({
				key,
				cacheValue: entry,
			}).then(response => {
				if (!response.ok) {
					console.error(
						`Error updating cache value for key "${key}" on primary instance (${primaryInstance}): ${response.status} ${response.statusText}`,
						{ entry },
					)
				}
			})
		}
	},
	async delete(key) {
		const { currentIsPrimary, primaryInstance } = await getInstanceInfo()
		if (currentIsPrimary) {
			preparedDelete.run(key)
		} else {
			// fire-and-forget cache update
			void updatePrimaryCacheValue!({
				key,
				cacheValue: undefined,
			}).then(response => {
				if (!response.ok) {
					console.error(
						`Error deleting cache value for key "${key}" on primary instance (${primaryInstance}): ${response.status} ${response.statusText}`,
					)
				}
			})
		}
	},
}

const preparedAllKeys = cacheDb.prepare('SELECT key FROM cache LIMIT ?')
export async function getAllCacheKeys(limit: number) {
	return {
		// .all return all matching rows
		sqlite: preparedAllKeys.all(limit).map(row => (row as { key: string }).key),
		lru: [...lruInstance.keys()],
	}
}

const preparedKeySearch = cacheDb.prepare(
	'SELECT key FROM cache WHERE key LIKE ? LIMIT ?',
)
export async function searchCacheKeys(search: string, limit: number) {
	return {
		sqlite: preparedKeySearch
			.all(`%${search}%`, limit) // In SQL, the % sign is used to define wildcards. So, %${search}% will match any string that contains the search string anywhere within it.
			.map(row => (row as { key: string }).key),
		lru: [...lruInstance.keys()].filter(key => key.includes(search)),
	}
}

export async function shouldForceFresh({
	forceFresh,
	request,
	key,
}: {
	forceFresh?: boolean | string
	request?: Request
	key: string
}) {
	if (typeof forceFresh === 'boolean') return forceFresh
	if (typeof forceFresh === 'string') return forceFresh.split(',').includes(key)

	if (!request) return false
	const fresh = new URL(request.url).searchParams.get('fresh')
	if (typeof fresh !== 'string') return false
	if ((await getUser(request))?.role !== 'ADMIN') return false
	if (fresh === '') return true

	return fresh.split(',').includes(key)
}

// 这个是添加了timing和log的cachified，用这个即可
export async function cachified<Value>({
	request,
	timings,
	...options
}: Omit<CachifiedOptions<Value>, 'forceFresh'> & {
	request?: Request
	timings?: Timings
	forceFresh?: boolean | string
}): Promise<Value> {
	let cachifiedResolved = false
	const cachifiedPromise = baseCachified(
		{
			...options,
			forceFresh: await shouldForceFresh({
				forceFresh: options.forceFresh,
				request,
				key: options.key,
			}),
			getFreshValue: async context => {
				// if we've already retrieved the cached value, then this may be called
				// after the response has already been sent so there's no point in timing
				// how long this is going to take
				if (!cachifiedResolved && timings) {
					return time(() => options.getFreshValue(context), {
						timings,
						type: `getFreshValue:${options.key}`,
						desc: `request forced to wait for a fresh ${options.key} value`,
					})
				}
				return options.getFreshValue(context)
			},
		},
		verboseReporter(),
	)
	const result = await time(cachifiedPromise, {
		timings,
		type: `cache:${options.key}`,
		desc: `${options.key} cache retrieval`,
	})
	cachifiedResolved = true
	return result
}
