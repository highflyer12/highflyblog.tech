// TODO:实现https://invertase.io/blog导航栏Icon变化小动画
/* eslint-disable jsx-a11y/anchor-has-content */
import {
	Menu,
	MenuButton,
	MenuItems,
	MenuLink,
	MenuPopover,
	useMenuButtonContext,
} from '@reach/menu-button'
import { Link, useFetcher, useLocation } from '@remix-run/react'
import { clsx } from 'clsx'
import {
	AnimatePresence,
	motion,
	useAnimation,
	useReducedMotion,
} from 'framer-motion'
import * as React from 'react'
import { useEffect } from 'react'
import useSound from 'use-sound'
import { useRequestInfo } from '#app/utils/request-info.ts'
import { THEME_FETCHER_KEY, useOptimisticThemeMode } from '#app/utils/theme.tsx'
import { useOptionalUser, useRootData } from '#app/utils/use-root-data.ts'
import { useElementState } from './hooks/use-element-state.tsx'
import { LaptopIcon, MoonIcon, SunIcon } from './icons.tsx'
import logoUrl from '/deer-log.svg'
import { Icon } from './ui/icon.tsx'

const LINKS = [
	{ name: 'Lastest', to: '/latest' },
	{ name: 'Posts', to: '/posts' },
	{ name: 'Courses', to: '/courses' },
	{ name: 'About', to: '/about' },
]

const MOBILE_LINKS = [{ name: 'Home', to: '/' }, ...LINKS]

function NavLink({
	to,
	...rest
}: Omit<Parameters<typeof Link>['0'], 'to'> & { to: string }) {
	const location = useLocation()
	const isSelected =
		to === location.pathname || location.pathname.startsWith(`${to}/`)

	return (
		<li className="px-5 py-2">
			<Link
				prefetch="intent"
				className={clsx(
					'underlined block whitespace-nowrap text-lg font-normal hover:text-primary focus:text-primary focus:outline-none',
					{
						'active text-primary': isSelected,
						'text-muted-foreground': !isSelected,
					},
				)}
				to={to}
				{...rest}
			/>
		</li>
	)
}

const iconTransformOrigin = { transformOrigin: '50% 100px' }
function DarkModeToggle() {
	const requestInfo = useRequestInfo()
	const fetcher = useFetcher({ key: THEME_FETCHER_KEY })

	const optimisticMode = useOptimisticThemeMode()
	const mode = optimisticMode ?? requestInfo.userPrefs.theme ?? 'system'
	const nextMode =
		mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system'

	const iconSpanClassName =
		'absolute inset-0 transform transition-transform duration-700 motion-reduce:duration-[0s]'
	return (
		<fetcher.Form method="POST" action="/action/set-theme">
			<input type="hidden" name="theme" value={nextMode} />

			<button
				type="submit"
				className={
					'inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-secondary p-1 transition hover:border-primary focus:border-primary focus:outline-none'
				}
			>
				{/* note that the duration is longer then the one on body, controlling the bg-color */}
				<div className="relative h-8 w-8">
					<span
						className={clsx(
							iconSpanClassName,
							mode === 'dark' ? 'rotate-0' : 'rotate-90',
						)}
						style={iconTransformOrigin}
					>
						<MoonIcon />
					</span>
					<span
						className={clsx(
							iconSpanClassName,
							mode === 'light' ? 'rotate-0' : '-rotate-90',
						)}
						style={iconTransformOrigin}
					>
						<SunIcon />
					</span>

					<span
						className={clsx(
							iconSpanClassName,
							mode === 'system' ? 'translate-y-0' : 'translate-y-10',
						)}
						style={iconTransformOrigin}
					>
						<LaptopIcon size={32} />
					</span>
				</div>
				<span className="sr-only ml-4">
					{`Switch to ${
						nextMode === 'system'
							? 'system'
							: nextMode === 'light'
								? 'light'
								: 'dark'
					} mode`}
				</span>
			</button>
		</fetcher.Form>
	)
}

function MobileMenuList() {
	const { isExpanded } = useMenuButtonContext()
	const shouldReduceMotion = useReducedMotion()

	useEffect(() => {
		if (isExpanded) {
			// don't use overflow-hidden, as that toggles the scrollbar and causes layout shift
			document.body.classList.add('fixed')
			document.body.classList.add('overflow-y-scroll')
			// alternatively, get bounding box of the menu, and set body height to that.
			document.body.style.height = '100vh'
		} else {
			document.body.classList.remove('fixed')
			document.body.classList.remove('overflow-y-scroll')
			document.body.style.removeProperty('height')
		}
	}, [isExpanded])

	return (
		<AnimatePresence>
			{isExpanded ? (
				<MenuPopover
					position={r => ({
						top: `calc(${Number(r?.top) + Number(r?.height)}px + 2.25rem)`, // 2.25 rem = py-9 from navbar
						left: 0,
						bottom: 0,
						right: 0,
					})}
					style={{ display: 'block' }}
					className="z-50"
				>
					<motion.div
						initial={{ y: -50, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: -50, opacity: 0 }}
						transition={{
							duration: shouldReduceMotion ? 0 : 0.15,
							ease: 'linear',
						}}
						className="flex h-full flex-col overflow-y-scroll border-t border-gray-200 bg-primary pb-12 dark:border-gray-600"
					>
						<MenuItems className="border-none bg-transparent p-0">
							{MOBILE_LINKS.map(link => (
								<MenuLink
									className="px-5vw hover:text-team-current border-b border-gray-200 py-9 text-primary hover:bg-secondary focus:bg-secondary dark:border-gray-600"
									key={link.to}
									as={Link}
									to={link.to}
								>
									{link.name}
								</MenuLink>
							))}
						</MenuItems>
					</motion.div>
				</MenuPopover>
			) : null}
		</AnimatePresence>
	)
}

const topVariants = {
	open: { rotate: 45, y: 7, originX: '16px', originY: '10px' },
	closed: { rotate: 0, y: 0, originX: 0, originY: 0 },
}

const centerVariants = {
	open: { opacity: 0 },
	closed: { opacity: 1 },
}

const bottomVariants = {
	open: { rotate: -45, y: -5, originX: '16px', originY: '22px' },
	closed: { rotate: 0, y: 0, originX: 0, originY: 0 },
}

function MobileMenu() {
	const shouldReduceMotion = useReducedMotion()
	const transition = shouldReduceMotion ? { duration: 0 } : {}
	return (
		<Menu>
			{({ isExpanded }) => {
				const state = isExpanded ? 'open' : 'closed'
				return (
					<>
						<MenuButton
							title="Site Menu"
							className="inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-secondary p-1 text-primary transition hover:border-primary focus:border-primary focus:outline-none"
						>
							<svg
								width="32"
								height="32"
								viewBox="0 0 32 32"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<motion.rect
									animate={state}
									variants={topVariants}
									transition={transition}
									x="6"
									y="9"
									width="20"
									height="2"
									rx="1"
									fill="currentColor"
								/>
								<motion.rect
									animate={state}
									variants={centerVariants}
									transition={transition}
									x="6"
									y="15"
									width="20"
									height="2"
									rx="1"
									fill="currentColor"
								/>
								<motion.rect
									animate={state}
									variants={bottomVariants}
									transition={transition}
									x="6"
									y="21"
									width="20"
									height="2"
									rx="1"
									fill="currentColor"
								/>
							</svg>
						</MenuButton>

						<MobileMenuList />
					</>
				)
			}}
		</Menu>
	)
}

// Timing durations used to control the speed of the team ring in the profile button.
// Time is seconds per full rotation
const durations = {
	initial: 40,
	hover: 3,
	focus: 3,
	active: 0.25,
}

function ProfileButton({
	imageUrl,
	imageAlt,
	magicLinkVerified,
}: {
	imageUrl: string
	imageAlt: string
	magicLinkVerified: boolean | undefined
}) {
	const user = useOptionalUser()
	const controls = useAnimation()
	const [ref, state] = useElementState()
	const shouldReduceMotion = useReducedMotion()

	React.useEffect(() => {
		void controls.start((_, { rotate = 0 }) => {
			const target =
				typeof rotate === 'number'
					? state === 'initial'
						? rotate - 360
						: rotate + 360
					: 360

			return shouldReduceMotion
				? {}
				: {
						rotate: [rotate, target],
						transition: {
							duration: durations[state],
							repeat: Infinity,
							ease: 'linear',
						},
					}
		})
	}, [state, controls, shouldReduceMotion])

	return (
		<Link
			prefetch="intent"
			to={user ? '/me' : magicLinkVerified ? '/signup' : '/login'}
			aria-label={
				user ? 'My Account' : magicLinkVerified ? 'Finish signing up' : 'Login'
			}
			className={clsx(
				'ml-4 inline-flex h-14 w-14 items-center justify-center rounded-full focus:outline-none',
			)}
			ref={ref}
		>
			<img
				className={clsx('inline h-10 w-10 select-none rounded-full')}
				src={imageUrl}
				alt={imageAlt}
				crossOrigin="anonymous"
			/>
		</Link>
	)
}

function SoundButton() {
	const [play] = useSound('/sounds/drop.wav')

	return (
		<button onClick={() => play()}>
			<Icon name="camera" />
		</button>
	)
}

function Navbar() {
	const { requestInfo, userInfo } = useRootData()
	const avatar = userInfo ? userInfo.avatar : { src: logoUrl, alt: 'avatar' }

	return (
		<div className="px-5vw py-2 lg:py-2">
			<nav className="max-w-8xl mx-auto flex items-center justify-between text-primary">
				<div className="flex justify-center gap-4 align-middle">
					<Link
						prefetch="intent"
						to="/"
						className="underlined block whitespace-nowrap text-2xl font-normal text-primary transition focus:outline-none"
					>
						<h1>High Fly</h1>
					</Link>
					<SoundButton />
				</div>

				<ul className="hidden lg:flex">
					{LINKS.map(link => (
						<NavLink key={link.to} to={link.to}>
							{link.name}
						</NavLink>
					))}
				</ul>

				<div className="flex items-center justify-center">
					<div className="block lg:hidden">
						<MobileMenu />
					</div>
					{/* <div className="noscript-hidden hidden lg:block">
						<DarkModeToggle />
					</div> */}

					{/* <ProfileButton
						magicLinkVerified={requestInfo.session.magicLinkVerified}
						imageUrl={avatar!.src}
						imageAlt={avatar!.alt}
					/> */}
				</div>
			</nav>
		</div>
	)
}

export { Navbar }
