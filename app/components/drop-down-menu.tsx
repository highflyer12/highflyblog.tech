// TODO: Add some animation
// TODO: Add a down arrow icon
// TODO: change the dropdown box to be irregular shape
import { Link } from '@remix-run/react'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Icon } from './ui/icon'

export const DropDown = () => {
	const profileRef = useRef<HTMLButtonElement>(null)

	const [isProfileActive, setIsProfileActive] = useState(false)

	useEffect(() => {
		const handleProfile = (e: MouseEvent) => {
			if (
				profileRef.current &&
				!(profileRef.current as HTMLElement).contains(e.target as Node)
			)
				setIsProfileActive(false)
		}
		document.addEventListener('click', handleProfile)
	}, [])

	return (
		<div className="relative flex-1 text-right">
			<button
				ref={profileRef}
				className="rounded-md p-1.5 text-gray-500 hover:bg-gray-50 active:bg-gray-100"
				onClick={() => setIsProfileActive(!isProfileActive)}
			>
				<Icon name="chevron-down" />
			</button>
			{isProfileActive ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{
						opacity: 1,
						transition: { duration: 0.5, ease: 'easeOut' },
					}}
					className="absolute right-0 top-12 z-10 w-64 rounded-lg border bg-white text-sm text-gray-600 shadow-md"
				>
					<div className="p-2 text-left">
						<span className="block p-2 text-gray-500/80">
							alivika@gmail.com
						</span>
						<Link
							to="/blog/201"
							className="block w-full rounded-md p-2 text-left duration-150 hover:bg-gray-50 active:bg-gray-100"
						>
							Add another account
						</Link>
						<div className="relative rounded-md duration-150 hover:bg-gray-50 active:bg-gray-100">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								className="pointer-events-none absolute inset-y-0 right-1 my-auto h-4 w-4"
							>
								<path
									fillRule="evenodd"
									d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z"
									clipRule="evenodd"
								/>
							</svg>
							<select
								className="w-full cursor-pointer appearance-none bg-transparent p-2 outline-none"
								title="Theme"
							>
								<option disabled selected>
									Theme
								</option>
								<option>Dark</option>
								<option>Light</option>
							</select>
						</div>
						<button className="block w-full rounded-md p-2 text-left duration-150 hover:bg-gray-50 active:bg-gray-100">
							Logout
						</button>
					</div>
					<div className=" absolute right-0 top-0 h-8 w-8 -translate-y-1/2 rotate-45 rounded-lg border bg-white text-sm text-gray-600 shadow-md"></div>
				</motion.div>
			) : (
				''
			)}
		</div>
	)
}
