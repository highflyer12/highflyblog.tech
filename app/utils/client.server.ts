// This just allows us to track individual clients so we can keep track of
// the posts they've read and make useful suggestions even if they're not logged in.
// 即对浏览器进行标识。
// 思考：这个'KCD_client_id' cookie是如何被设置的？在哪里被设置的？refer 'root.tsx'.

import { createCookieSessionStorage } from '@remix-run/node'
import * as uuid from 'uuid'
import { getRequiredServerEnvVar } from './misc.tsx'

const clientStorage = createCookieSessionStorage({
	cookie: {
		name: 'KCD_client_id',
		secure: true,
		secrets: [getRequiredServerEnvVar('SESSION_SECRET')],
		sameSite: 'lax',
		path: '/',
		httpOnly: true,
	},
})

// handle logged-in vs. anonymous differently
async function getClientSession(request: Request, user: {} | null) {
	const session = await clientStorage.getSession(request.headers.get('Cookie'))

	// no client ID for you on my 100th birthday! 😂
	const expires = new Date('2088-10-18')
	const initialValue = user
		? null
		: await clientStorage.commitSession(session, { expires })
	// 作者说为了降低race condition的可能，只在session发生了变化才通过“set-cookie”更改header。
	async function commit() {
		if (user) {
			// user登录后，此前用来标识用户的session这个cookie就没必要存在了，需要destroy！
			if (initialValue) {
				const value = await clientStorage.destroySession(session)
				return value
			} else {
				// 这说明用户一上来就登录了
				return null
			}
		} else {
			// 用户未登录，要给他在header里设置个cookie【如果还没有的话】
			const currentValue = await clientStorage.commitSession(session, {
				expires,
			})
			return currentValue === initialValue ? null : currentValue
		}
	}

	function getClientId() {
		if (user) return null
		let clientId = session.get('clientId') as string | undefined
		if (typeof clientId === 'string') return clientId
		clientId = uuid.v4()
		session.set('clientId', clientId)
		return clientId
	}

	// get the clientId set if it's not already
	getClientId()

	return {
		getClientId,
		commit,
		setUser(usr: {} | null) {
			user = usr
		},
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

export { getClientSession }
