// 从程序设计来看，比较复杂、常用的读写数据库操作，应该放在这里，而不是在页面中直接调用prisma
import { remember } from '@epic-web/remember'
import { PrismaClient } from '@prisma/client'
import chalk from 'chalk'
import { ensurePrimary } from '#app/utils/cjs/litefs-js.server.js'
import { time, type Timings } from './timing.server'

export const prisma = remember('prisma', () => {
	// NOTE: if you change anything in this function you'll need to restart
	// the dev server to see your changes.

	// Feel free to change this log threshold to something that makes sense for you
	const logThreshold = 20

	const client = new PrismaClient({
		log: [
			{ level: 'query', emit: 'event' },
			{ level: 'error', emit: 'stdout' },
			{ level: 'warn', emit: 'stdout' },
		],
	})
	client.$on('query', async e => {
		if (e.duration < logThreshold) return
		const color =
			e.duration < logThreshold * 1.1
				? 'green'
				: e.duration < logThreshold * 1.2
					? 'blue'
					: e.duration < logThreshold * 1.3
						? 'yellow'
						: e.duration < logThreshold * 1.4
							? 'redBright'
							: 'red'
		const dur = chalk[color](`${e.duration}ms`)
		console.info(`prisma:query - ${dur} - ${e.query}`)
	})
	client.$connect()
	return client
})

export const sessionExpirationTime = 1000 * 60 * 60 * 24 * 365 // 1 year
export const linkExpirationTime = 1000 * 60 * 30 // 30 minutes

// 主要是判断session是否过期，如果过期则删除session；如果session剩余时间小于6个月，则延长session时间
export async function getUserFromSessionId(
	sessionId: string,
	{ timings }: { timings?: Timings } = {},
) {
	const session = await time(
		prisma.session.findUnique({
			where: { id: sessionId },
			include: { user: true },
		}),
		{ timings, type: 'getUserFromSessionId' },
	)
	if (!session) {
		throw new Error('No user found')
	}

	if (Date.now() > session.expirationDate.getTime()) {
		await ensurePrimary()
		await prisma.session.delete({ where: { id: sessionId } })
		throw new Error('Session expired. Please request a new magic link.')
	}

	// if there's less than ~six months left, extend the session
	const twoWeeks = 1000 * 60 * 60 * 24 * 30 * 6
	if (Date.now() + twoWeeks > session.expirationDate.getTime()) {
		await ensurePrimary()
		const newExpirationDate = new Date(Date.now() + sessionExpirationTime)
		await prisma.session.update({
			data: { expirationDate: newExpirationDate },
			where: { id: sessionId },
		})
	}

	return session.user
}

export async function addPostRead({
	slug,
	userId,
	clientId,
}: { slug: string } & (
	| { userId: string; clientId?: undefined }
	| { userId?: undefined; clientId: string } // 两个参数只能有一个，且必有一个
)) {
	const id = userId ? { userId } : { clientId }
	// 判断是否在过去的一周内阅读过，如果阅读过则不再记录，避免刷阅读量
	const readInLastWeek = await prisma.postRead.findFirst({
		select: { id: true },
		where: {
			...id,
			postSlug: slug,
			createdAt: { gt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) },
		},
	})
	if (readInLastWeek) {
		return null
	} else {
		const postRead = await prisma.postRead.create({
			data: { postSlug: slug, ...id },
			select: { id: true },
		})
		return postRead
	}
}
