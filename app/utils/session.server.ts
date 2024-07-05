/**!SECTION
 * The basics of auth flow:
	Get the session ID from the session cookie
	Get the user ID from the session
	Get the user
	Update the expiration time so active users rarely need to re-authenticate
	If any of these fails, cleanup and redirect
 */
import { type User, type Session } from '@prisma/client'
import { createCookieSessionStorage } from '@remix-run/node'
import { ensurePrimary } from 'litefs-js/remix'
import {
	getUserFromSessionId,
	prisma,
	sessionExpirationTime,
} from './db.server'
import { getRequiredServerEnvVar } from './misc'
import { type Timings } from './timing.server'

export const authSessionStorage = createCookieSessionStorage({
	cookie: {
		name: 'en_session',
		sameSite: 'lax', // CSRF protection is advised if changing to 'none'
		path: '/',
		httpOnly: true,
		secrets: process.env.SESSION_SECRET.split(','),
		secure: process.env.NODE_ENV === 'production',
	},
})

// we have to do this because every time you commit the session you overwrite it
// so we store the expiration time in the cookie and reset it every time we commit
const originalCommitSession = authSessionStorage.commitSession

Object.defineProperty(authSessionStorage, 'commitSession', {
	value: async function commitSession(
		...args: Parameters<typeof originalCommitSession>
	) {
		const [session, options] = args
		if (options?.expires) {
			session.set('expires', options.expires)
		}
		if (options?.maxAge) {
			session.set('expires', new Date(Date.now() + options.maxAge * 1000))
		}
		const expires = session.has('expires')
			? new Date(session.get('expires'))
			: undefined
		const setCookieHeader = await originalCommitSession(session, {
			...options,
			expires,
		})
		return setCookieHeader
	},
})

const sessionIdKey = '__session_id__'

const sessionStorage = createCookieSessionStorage({
	cookie: {
		name: 'KCD_root_session',
		secure: true,
		secrets: [getRequiredServerEnvVar('SESSION_SECRET')],
		sameSite: 'lax',
		path: '/',
		maxAge: sessionExpirationTime / 1000,
		httpOnly: true,
	},
})

export async function getSession(request: Request) {
	const session = await sessionStorage.getSession(request.headers.get('Cookie'))
	const initialValue = await sessionStorage.commitSession(session)
	const getSessionId = () => session.get(sessionIdKey) as string | undefined
	const unsetSessionId = () => session.unset(sessionIdKey)

	const commit = async () => {
		const currentValue = await sessionStorage.commitSession(session)
		return currentValue === initialValue ? null : currentValue
	}
	return {
		session,
		getUser: async ({ timings }: { timings?: Timings } = {}) => {
			const token = getSessionId()
			if (!token) return null

			return getUserFromSessionId(token, { timings }).catch(
				(error: unknown) => {
					unsetSessionId()
					console.error(`Failure getting user from session ID:`, error)
					return null
				},
			)
		},
		getSessionId,
		unsetSessionId,
		signIn: async (user: Pick<User, 'id'>) => {
			const userSession = await createSession({ userId: user.id })
			session.set(sessionIdKey, userSession.id)
		},
		signOut: async () => {
			const sessionId = getSessionId()
			if (sessionId) {
				await ensurePrimary()
				unsetSessionId()
				prisma.session
					.delete({ where: { id: sessionId } })
					.catch((error: unknown) => {
						console.error(`Failure deleting user session: `, error)
					})
			}
		},
		commit,
		/**
		 * This will initialize a Headers object if one is not provided.
		 * It will set the 'Set-Cookie' header value on that headers object.
		 * It will then return that Headers object.
		 */
		getHeaders: async (headers: ResponseInit['headers'] = new Headers()) => {
			const value = await commit()
			if (!value) return headers
			if (headers instanceof Headers) {
				headers.append('Set-Cookie', value)
			} else if (Array.isArray(headers)) {
				headers.push(['Set-Cookie', value])
			} else {
				headers['Set-Cookie'] = value
			}
			return headers
		},
	}
}

export async function createSession(
	sessionData: Omit<
		Session,
		'id' | 'createdAt' | 'expirationDate' | 'updatedAt'
	>,
) {
	ensurePrimary()
	const session = await prisma.session.create({
		data: {
			...sessionData,
			expirationDate: new Date(Date.now() + sessionExpirationTime),
		},
	})
	return session
}

export async function getUser(
	request: Request,
	{ timings }: { timings?: Timings } = {},
) {
	const { session } = await getSession(request)
	const token = session.get(sessionIdKey) as string | undefined
	if (!token) return null
	return getUserFromSessionId(token, { timings }).catch((error: unknown) => {
		console.error(`Failure getting user from session ID:`, error)
		return null
	})
}
