import { useFormAction, useNavigation } from '@remix-run/react'
import { clsx, type ClassValue } from 'clsx'
import * as dateFns from 'date-fns'
import md5 from 'md5-hash'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSpinDelay } from 'spin-delay'
import { extendTailwindMerge } from 'tailwind-merge'
import { type OptionalTeam, type Team } from '../../types/index'
import { images } from '../images.tsx'
import { extendedTheme } from './extended-theme.ts'
import { HeadersFunction } from '@remix-run/node'
import React from 'react'

const defaultAvatarSize = 128
/** get a gravatar image URL based on an email address
 * How gravatar Works:
	1. User Signs Up: A user signs up for your service and provides their email address.
    2. Email Hashing: Your application creates a SHA256 hash of the user’s email address. This hash is used to construct a URL that links to their Gravatar.
    3. Avatar Display: You use this URL to display the user’s Gravatar wherever you need an avatar in your application.
 *  */
export function getAvatar(
	email: string,
	{
		size = defaultAvatarSize,
		fallback = images.kodyProfileGray({ resize: { width: size } }),
		origin,
	}: { size?: number } & (
		| { fallback?: null; origin?: null }
		| { fallback: string; origin?: string }
	) = {},
) {
	// @ts-expect-error: this due to the default export, need to add .default
	const hash = md5.default(email)
	const url = new URL(`https://www.gravatar.com/avatar/${hash}`)
	url.searchParams.set('size', String(size))
	if (fallback) {
		if (origin && fallback.startsWith('/')) {
			fallback = `${origin}${fallback}`
		}
		url.searchParams.set('default', fallback)
	}
	return url.toString()
}

export function getUserImgSrc(imageId?: string | null) {
	return imageId ? `/resources/user-images/${imageId}` : '/img/user.png'
}

export function getNoteImgSrc(imageId: string) {
	return `/resources/note-images/${imageId}`
}

export function getErrorMessage(error: unknown) {
	if (typeof error === 'string') return error
	if (
		error &&
		typeof error === 'object' &&
		'message' in error &&
		typeof error.message === 'string'
	) {
		return error.message
	}
	console.error('Unable to get error message for error', error)
	return 'Unknown Error'
}

function formatColors() {
	const colors = []
	for (const [key, color] of Object.entries(extendedTheme.colors)) {
		if (typeof color === 'string') {
			colors.push(key)
		} else {
			const colorGroup = Object.keys(color).map(subKey =>
				subKey === 'DEFAULT' ? '' : subKey,
			)
			colors.push({ [key]: colorGroup })
		}
	}
	return colors
}

const customTwMerge = extendTailwindMerge<string, string>({
	extend: {
		theme: {
			colors: formatColors(),
			borderRadius: Object.keys(extendedTheme.borderRadius),
		},
		classGroups: {
			'font-size': [
				{
					text: Object.keys(extendedTheme.fontSize),
				},
			],
		},
	},
})

export function cn(...inputs: ClassValue[]) {
	return customTwMerge(clsx(inputs))
}

export function getDomainUrl(request: Request) {
	const host =
		request.headers.get('X-Forwarded-Host') ??
		request.headers.get('host') ??
		new URL(request.url).host
	const protocol = host.includes('localhost') ? 'http' : 'https'
	return `${protocol}://${host}`
}

export function getReferrerRoute(request: Request) {
	// spelling errors and whatever makes this annoyingly inconsistent
	// in my own testing, `referer` returned the right value, but 🤷‍♂️
	const referrer =
		request.headers.get('referer') ??
		request.headers.get('referrer') ??
		request.referrer
	const domain = getDomainUrl(request)
	if (referrer?.startsWith(domain)) {
		return referrer.slice(domain.length)
	} else {
		return '/'
	}
}

/**
 * Merge multiple headers objects into one (uses set so headers are overridden)
 */
export function mergeHeaders(
	...headers: Array<ResponseInit['headers'] | null | undefined>
) {
	const merged = new Headers()
	for (const header of headers) {
		if (!header) continue
		for (const [key, value] of new Headers(header).entries()) {
			merged.set(key, value)
		}
	}
	return merged
}

/**
 * Combine multiple header objects into one (uses append so headers are not overridden)
 */
export function combineHeaders(
	...headers: Array<ResponseInit['headers'] | null | undefined>
) {
	const combined = new Headers()
	for (const header of headers) {
		if (!header) continue
		for (const [key, value] of new Headers(header).entries()) {
			combined.append(key, value)
		}
	}
	return combined
}

/**
 * Combine multiple response init objects into one (uses combineHeaders)
 */
export function combineResponseInits(
	...responseInits: Array<ResponseInit | null | undefined>
) {
	let combined: ResponseInit = {}
	for (const responseInit of responseInits) {
		combined = {
			...responseInit,
			headers: combineHeaders(combined.headers, responseInit?.headers),
		}
	}
	return combined
}

/**
 * Returns true if the current navigation is submitting the current route's
 * form. Defaults to the current route's form action and method POST.
 *
 * Defaults state to 'non-idle'
 *
 * NOTE: the default formAction will include query params, but the
 * navigation.formAction will not, so don't use the default formAction if you
 * want to know if a form is submitting without specific query params.
 */
export function useIsPending({
	formAction,
	formMethod = 'POST',
	state = 'non-idle',
}: {
	formAction?: string
	formMethod?: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE'
	state?: 'submitting' | 'loading' | 'non-idle'
} = {}) {
	const contextualFormAction = useFormAction()
	const navigation = useNavigation()
	const isPendingState =
		state === 'non-idle'
			? navigation.state !== 'idle'
			: navigation.state === state
	return (
		isPendingState &&
		navigation.formAction === (formAction ?? contextualFormAction) &&
		navigation.formMethod === formMethod
	)
}

/**
 * This combines useSpinDelay (from https://npm.im/spin-delay) and useIsPending
 * from our own utilities to give you a nice way to show a loading spinner for
 * a minimum amount of time, even if the request finishes right after the delay.
 *
 * This avoids a flash of loading state regardless of how fast or slow the
 * request is.
 */
export function useDelayedIsPending({
	formAction,
	formMethod,
	delay = 400,
	minDuration = 300,
}: Parameters<typeof useIsPending>[0] &
	Parameters<typeof useSpinDelay>[1] = {}) {
	const isPending = useIsPending({ formAction, formMethod })
	const delayedIsPending = useSpinDelay(isPending, {
		delay,
		minDuration,
	})
	return delayedIsPending
}

function callAll<Args extends Array<unknown>>(
	...fns: Array<((...args: Args) => unknown) | undefined>
) {
	return (...args: Args) => fns.forEach(fn => fn?.(...args))
}

/**
 * Use this hook with a button and it will make it so the first click sets a
 * `doubleCheck` state to true, and the second click will actually trigger the
 * `onClick` handler. This allows you to have a button that can be like a
 * "are you sure?" experience for the user before doing destructive operations.
 */
export function useDoubleCheck() {
	const [doubleCheck, setDoubleCheck] = useState(false)

	function getButtonProps(
		props?: React.ButtonHTMLAttributes<HTMLButtonElement>,
	) {
		const onBlur: React.ButtonHTMLAttributes<HTMLButtonElement>['onBlur'] =
			() => setDoubleCheck(false)

		const onClick: React.ButtonHTMLAttributes<HTMLButtonElement>['onClick'] =
			doubleCheck
				? undefined
				: e => {
						e.preventDefault()
						setDoubleCheck(true)
					}

		const onKeyUp: React.ButtonHTMLAttributes<HTMLButtonElement>['onKeyUp'] =
			e => {
				if (e.key === 'Escape') {
					setDoubleCheck(false)
				}
			}

		return {
			...props,
			onBlur: callAll(onBlur, props?.onBlur),
			onClick: callAll(onClick, props?.onClick),
			onKeyUp: callAll(onKeyUp, props?.onKeyUp),
		}
	}

	return { doubleCheck, getButtonProps }
}

/**
 * Simple debounce implementation
 */
function debounce<Callback extends (...args: Parameters<Callback>) => void>(
	fn: Callback,
	delay: number,
) {
	let timer: ReturnType<typeof setTimeout> | null = null
	return (...args: Parameters<Callback>) => {
		if (timer) clearTimeout(timer)
		timer = setTimeout(() => {
			fn(...args)
		}, delay)
	}
}

/**
 * Debounce a callback function
 */
export function useDebounce<
	Callback extends (...args: Parameters<Callback>) => ReturnType<Callback>,
>(callback: Callback, delay: number) {
	const callbackRef = useRef(callback)
	useEffect(() => {
		callbackRef.current = callback
	})
	return useMemo(
		() =>
			debounce(
				(...args: Parameters<Callback>) => callbackRef.current(...args),
				delay,
			),
		[delay],
	)
}

export async function downloadFile(url: string, retries: number = 0) {
	const MAX_RETRIES = 3
	try {
		const response = await fetch(url)
		if (!response.ok) {
			throw new Error(`Failed to fetch image with status ${response.status}`)
		}
		const contentType = response.headers.get('content-type') ?? 'image/jpg'
		const blob = Buffer.from(await response.arrayBuffer())
		return { contentType, blob }
	} catch (e) {
		if (retries > MAX_RETRIES) throw e
		return downloadFile(url, retries + 1)
	}
}

export const formatNumber = (num: number) => new Intl.NumberFormat().format(num)

/**
// Example usage:
console.log(formatAbbreviatedNumber(999));           // "999"
console.log(formatAbbreviatedNumber(1000));          // "1.00k"
console.log(formatAbbreviatedNumber(1500000));       // "1.50m"
console.log(formatAbbreviatedNumber(2000000000));    // "2.00b"
 */
export function formatAbbreviatedNumber(num: number) {
	return num < 1_000
		? formatNumber(num)
		: num < 1_000_000
			? `${formatNumber(Number((num / 1_000).toFixed(2)))}k`
			: num < 1_000_000_000
				? `${formatNumber(Number((num / 1_000_000).toFixed(2)))}m`
				: num < 1_000_000_000_000
					? `${formatNumber(Number((num / 1_000_000_000).toFixed(2)))}b`
					: 'a lot'
}

export function formatDate(dateString: string | Date, format = 'PPP') {
	if (typeof dateString !== 'string') {
		dateString = dateString.toISOString()
	}
	return dateFns.format(parseDate(dateString), format)
}

export function parseDate(dateString: string) {
	return dateFns.add(dateFns.parseISO(dateString), {
		minutes: new Date().getTimezoneOffset(),
	})
}

// returns a boolean indicating whether the value is truthy (not an empty string, 0, false, null, or undefined).
export function typedBoolean<T>(
	value: T,
): value is Exclude<T, '' | 0 | false | null | undefined> {
	return Boolean(value)
}

function getRequiredEnvVarFromObj(
	obj: Record<string, string | undefined>,
	key: string,
	devValue: string = `${key}-dev-value`,
) {
	let value = devValue
	const envVal = obj[key]
	if (envVal) {
		value = envVal
	} else if (obj.NODE_ENV === 'production') {
		throw new Error(`${key} is a required env variable`)
	}
	return value
}

export function getRequiredServerEnvVar(key: string, devValue?: string) {
	return getRequiredEnvVarFromObj(process.env, key, devValue)
}

export const teams: Array<Team> = ['RED', 'BLUE', 'YELLOW']
export const optionalTeams: Array<OptionalTeam> = [...teams, 'UNKNOWN']

// work both in a browser and a Node.js environment.
export function toBase64(string: string) {
	if (typeof window === 'undefined') {
		return Buffer.from(string).toString('base64')
	} else {
		return window.btoa(string)
	}
}

export function getUrl(requestInfo?: { origin: string; path: string }) {
	return removeTrailingSlash(
		`${getOrigin(requestInfo)}${requestInfo?.path ?? ''}`,
	)
}

function removeTrailingSlash(s: string) {
	return s.endsWith('/') ? s.slice(0, -1) : s
}

export function getDisplayUrl(requestInfo?: { origin: string; path: string }) {
	return getUrl(requestInfo).replace(/^https?:\/\//, '')
}

export function getOrigin(requestInfo?: { origin?: string; path: string }) {
	return requestInfo?.origin ?? 'https://highflyblog.tech' // or hfspace.me
}

/**
 * In TypeScript, asserts slug is string is a special type of return type for a function, known as an assertion signature. It's used in a function that performs a runtime check that verifies a certain condition and doesn't return a value.
   In this case, asserts slug is string is saying that the function will assert that slug is a string. If the function completes without throwing an error, TypeScript will treat slug as a string in the code that follows the call to the function.
   确保slug没有奇怪的字符
 */
export function requireValidSlug(slug: unknown): asserts slug is string {
	if (typeof slug !== 'string' || !/^[a-zA-Z0-9-_.]+$/.test(slug)) {
		throw new Response(`This is not a valid slug: "${slug}"`, { status: 400 })
	}
}

export const isTeam = (team?: string): team is Team =>
	teams.includes(team as Team)
export const getOptionalTeam = (team?: string): OptionalTeam =>
	isTeam(team) ? team : 'UNKNOWN'
export const getTeam = (team?: string): Team | null =>
	isTeam(team) ? team : null

/**
 * Each route can define its own HTTP headers.这里是对三个常用header属性赋值。
 * loader函数中的headers优先级最高，如果缺失数值，则从parentHeaders中获取。
 */
export const reuseUsefulLoaderHeaders: HeadersFunction = ({
	loaderHeaders,
	parentHeaders,
}) => {
	const headers = new Headers()
	const usefulHeaders = ['Cache-Control', 'Vary', 'Server-Timing']
	for (const headerName of usefulHeaders) {
		if (loaderHeaders.has(headerName)) {
			headers.set(headerName, loaderHeaders.get(headerName)!)
		}
	}
	const appendHeaders = ['Server-Timing']
	for (const headerName of appendHeaders) {
		if (parentHeaders.has(headerName)) {
			headers.append(headerName, parentHeaders.get(headerName)!)
		}
	}
	const useIfNotExistsHeaders = ['Cache-Control', 'Vary']
	for (const headerName of useIfNotExistsHeaders) {
		if (!headers.has(headerName) && parentHeaders.has(headerName)) {
			headers.set(headerName, parentHeaders.get(headerName)!)
		}
	}

	return headers
}

// 这个是在不作navigation的情况下，更新浏览器的url的query string，模拟页面跳转、地址栏也变化的效果。相当于在搜索框输入新的search term, 会直接提现在地址栏中。
// 注意：该函数最后部分用的是window.history.replaceState(null, '', newUrl)，因此history stack 中只会出现一次）
export function useUpdateQueryStringValueWithoutNavigation(
	queryKey: string,
	queryValue: string,
) {
	React.useEffect(() => {
		const currentSearchParams = new URLSearchParams(window.location.search)
		const oldQuery = currentSearchParams.get(queryKey) ?? ''
		if (queryValue === oldQuery) return

		if (queryValue) {
			currentSearchParams.set(queryKey, queryValue)
		} else {
			currentSearchParams.delete(queryKey)
		}
		const newUrl = [window.location.pathname, currentSearchParams.toString()]
			.filter(Boolean)
			.join('?')
		// alright, let's talk about this...
		// Normally with remix, you'd update the params via useSearchParams from react-router-dom
		// and updating the search params will trigger the search to update for you.
		// However, it also triggers a navigation to the new url, which will trigger
		// the loader to run which we do not want because all our data is already
		// on the client and we're just doing client-side filtering of data we
		// already have. So we manually call `window.history.pushState` to avoid
		// the router from triggering the loader.
		window.history.replaceState(null, '', newUrl)
	}, [queryKey, queryValue])
}
