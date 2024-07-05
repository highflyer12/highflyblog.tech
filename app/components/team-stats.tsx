import { Link } from '@remix-run/react'
import { clsx } from 'clsx'
import { motion, useReducedMotion } from 'framer-motion'
import * as React from 'react'
import { kodyProfiles } from '#app/images.tsx'
import { formatNumber, getOptionalTeam } from '#app/utils/misc.tsx'
import { useTeam } from '#app/utils/team-provider.tsx'
import { useOptionalUser, useRootData } from '#app/utils/use-root-data.ts'
import { type Team } from '#types'

const barColors: Record<Team, string> = {
	RED: 'bg-team-red',
	YELLOW: 'bg-team-yellow',
	BLUE: 'bg-team-blue',
}

type ReadRanking = {
	totalReads: number
	team: Team
	percent: number
	ranking: number
}

/**
 * 关于framer motion的使用，可以参考：https://blog.maximeheckel.com/posts/guide-animations-spark-joy-framer-motion
 * * Anatomy of an animation：
 *  1）"Where/how is my element at the beginning?" i.e the initial state
 *  2）"Where it needs to go or which shape it needs to take by the end?" i.e. the target state
 *  3）"How it's going to transition from the initial state to the end state?" i.e. the transition state
 * 其他一些概念：
 *  1）can substitute the animate prop for one of the more specific gesture props like whileHover or whileTap. They can take the same "animation object" we just saw. Only one of animate or any of the gesture props is required to define an animated Framer Motion component.
 *  2）The library provides smart defaults for initial and transition when they are not defined. It will even adapt the transition type (spring, tween, ease) based on which property you set in your animate prop!【transition未定义的情况】
 **/
function Stat({
	totalReads,
	team,
	percent,
	ranking,
	direction,
	display,
	onClick,
}: ReadRanking & {
	direction: 'up' | 'down'
	display: 'ranking' | 'reads'
	onClick?: () => void
}) {
	const { userInfo } = useRootData()
	const [currentTeam] = useTeam()
	const avatar = userInfo
		? userInfo.avatar
		: kodyProfiles[getOptionalTeam(team)]
	const isUsersTeam = team === currentTeam

	const MotionEl = onClick ? motion.button : motion.div

	const shouldReduceMotion = useReducedMotion() // 自动从设备或者os获取数值
	const transition = shouldReduceMotion ? { duration: 0 } : {}

	return (
		<MotionEl
			tabIndex={0} // By default, non-interactive elements like div, span, p, etc., are not focusable via the Tab key. Add tabIndex={0} to make such an element focusable.
			onClick={onClick}
			title={
				display === 'ranking'
					? `Rank of the ${team.toLowerCase()} team`
					: `Total reads by the ${team.toLowerCase()} team`
			} // displayed as a tooltip text when the mouse moves over the element.
			initial="initial"
			whileHover="hover"
			whileFocus="hover"
			className="relative flex origin-right items-center justify-center focus:outline-none"
			transition={transition}
			variants={{
				initial: { width: 22 },
			}}
		>
			<motion.div
				transition={transition}
				variants={{
					initial: {
						height: 12 + 24 * percent,
						width: 16,
						y: direction === 'up' ? '-100%' : 0,
					},
					hover: { height: 48, width: 24 },
				}}
				className={clsx(
					'relative flex justify-center',
					{
						'rounded-t-md': direction === 'up',
						'rounded-b-md': direction === 'down',
					},
					barColors[team],
				)}
			>
				<motion.span
					transition={transition}
					variants={{
						initial: { opacity: 0, scale: 1, y: 0, fontSize: 0 },
						hover: {
							opacity: 1,
							scale: 1,
							y: direction === 'up' ? '-100%' : '100%', // 是通过这个移出parent div的
							fontSize: '18px',
						},
					}}
					className={clsx('absolute text-lg font-medium text-primary', {
						'bottom-0': direction === 'down',
						'top-0': direction === 'up',
					})}
				>
					{formatNumber(display === 'ranking' ? ranking : totalReads)}
				</motion.span>
			</motion.div>

			{/* 居中absolute positioned div：left-1/2: moves the left edge of the element to the middle of the parent; then x: '-50%' animation moves the element left by half of its width, effectively centering the element */}
			{isUsersTeam ? (
				<motion.div
					className="border-team-current absolute left-1/2 top-0 rounded-md"
					transition={transition}
					variants={{
						initial: {
							width: 22,
							height: 22,
							x: '-50%',
							y: direction === 'up' ? 4 : -26,
							borderWidth: 2,
							borderRadius: 4,
						},
						hover: {
							width: 36,
							height: 36,
							x: '-50%',
							y: direction === 'up' ? 6 : -42,
							borderWidth: 3,
							borderRadius: 8,
						},
					}}
				>
					<motion.img
						transition={transition}
						variants={{
							initial: { borderWidth: 2, borderRadius: 4 - 2 },
							hover: { borderWidth: 4, borderRadius: 8 - 3 },
						}}
						className="h-full w-full border-white object-cover dark:border-gray-900"
						src={avatar.src}
						alt={avatar.alt}
					/>
				</motion.div>
			) : null}
		</MotionEl>
	)
}

function TeamStats({
	totalReads,
	rankings,
	direction,
	pull,
	onStatClick,
}: {
	totalReads: string
	rankings: Array<ReadRanking>
	direction: 'up' | 'down'
	pull: 'left' | 'right'
	onStatClick?: (team: Team) => void
}) {
	const optionalUser = useOptionalUser()
	const [altDown, setAltDown] = React.useState(false) // alt键按下后，显示从rankings到reads的转换
	const [team] = useTeam()

	/*
	 *【使用useEffect添加keyboard eventListener来获取用户是否按下alt键】
	 * 关于keyBoardEvent：键盘事件我们是对keyDown、keyUp、keyPress等事件的监测，具体是哪个按键触发的，需要后续在callback函数中判断。【也就是说，能有许多个按键触发相同的键盘事件：比如：keyDown is triggered when you press any key； keyPress is only triggered when the key you press can produce a character.】
	 */

	React.useEffect(() => {
		const set = (e: KeyboardEvent) => setAltDown(e.altKey) // The altKey property is a boolean that indicates whether the Alt key was down when the event was fired.
		document.addEventListener('keydown', set)
		document.addEventListener('keyup', set)
		return () => {
			document.removeEventListener('keyup', set)
			document.removeEventListener('keydown', set)
		}
	}, [])

	const loginLink = optionalUser ? null : (
		<div
			className={clsx('text-center', {
				'mb-2': direction === 'down',
				'mt-2': direction === 'up',
			})}
		>
			{/* underlined是带动画的，refer app.css */}
			<Link to="/login" className="underlined">
				{' '}
				Login
			</Link>
		</div>
	)

	/**
	 * *一些tailwindcss知识点、小技巧：
	 * 1) 在container中使用group，子元素可以使用group-hover和group-focus来设置样式【based on the hover state of their parent container———达到hover、focus container与子元素相同的效果】；
	 * 2) display: inline-flex does not make flex items display inline. It makes the【flex container display inline】. That is the only difference between display: inline-flex and display: flex.【下面这个用inline-flex是为了保证容器高度为h-8】
	 * 3）如何把子元素恰好移到容器框的外面【比如使子元素的上边与容器的底重合】：容器relative，子元素absolute，bottom-0，在通过动画移动子元素的位置【这里是通过y: '-100%'】【这样，无论容器大小以及子元素大小如何变化，他们的相对位置都是固定的】；
	 * 4)对齐到容器的底线：flex-col justify-end,并结合h-0 overflow-visible【这样li元素的高度为0，但是内容可以显示出来】。
	 * 5）要养成用container控制布局、相对位置的意识。比如list of stat放在h-0的ul中。【一般来说container的位置更容易控制，其子元素相对于container的位置也容易调整】
	 */
	return (
		<div
			className={clsx(
				'group relative inline-flex h-8 flex-col justify-end',
				`set-color-team-current-${team.toLowerCase()}`,
				{
					'justify-end': direction === 'down',
					'justify-start': direction === 'up',
				},
			)}
		>
			<div
				className={clsx(
					'absolute flex h-8 items-center gap-2 text-sm opacity-0 transition focus-within:opacity-100 group-hover:opacity-100',
					{
						'right-0': pull === 'right',
						'left-0': pull === 'left',
						'-top-9': direction === 'down',
						'-bottom-20': !loginLink && direction === 'up',
						'-bottom-9': loginLink && direction === 'up',
					},
				)}
			>
				<span title="Total reads" className="text-primary">
					{totalReads}{' '}
				</span>
				<Link
					className="underlined hover:text-team-current focus:text-team-current text-secondary"
					to="/teams#read-rankings"
				>
					{`what's this?`}
				</Link>
			</div>
			{direction === 'down' ? loginLink : null}
			<ul
				className={clsx(
					'border-team-current relative flex h-0 overflow-visible px-4',
					{
						'border-t': direction === 'down',
						'border-b': direction === 'up',
					},
				)}
			>
				{/* 通过设置h-0 overflow-visible，使得li元素的高度为0，但是内容可以显示出来 */}
				{rankings.map(ranking => (
					<li key={ranking.team} className="h-0 overflow-visible">
						<Stat
							// trigger a re-render if the percentage changes
							key={ranking.percent}
							{...ranking}
							direction={direction}
							display={altDown ? 'reads' : 'ranking'}
							onClick={
								onStatClick ? () => onStatClick(ranking.team) : undefined
							}
						/>
					</li>
				))}
			</ul>
			{direction === 'up' ? loginLink : null}
		</div>
	)
}

export { TeamStats }
