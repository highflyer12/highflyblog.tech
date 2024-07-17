// export function Heart() {
// 	return (
// 		<>
// 			<div>
// 				<div
// 					className="before:rounded-r-[50px]before:rounded-b-0 before:rounded-l-0 after:rounded-b-0
// after:rounded-l-0 relative h-[90px] w-[100px]
// before:absolute before:left-[50px] before:top-0
// before:h-[80px] before:w-[50px]
// before:origin-[0_100%] before:-rotate-45 before:rounded-t-[50px]

// before:bg-primary before:content-[''] after:absolute after:left-0 after:top-0
// after:h-[80px] after:w-[50px] after:origin-[100%_100%]
// after:rotate-45 after:rounded-r-[50px] after:rounded-t-[50px] after:bg-primary
// after:content-['']
// "
// 				></div>
// 			</div>
// 		</>
// 	)
// }

import { motion } from 'framer-motion'
import { useState } from 'react'

export function Heart() {
	const [fill, setFill] = useState(0)

	const handleClick = () => {
		setFill(prev => (prev < 100 ? prev + 20 : 100))
	}

	return (
		<div onClick={handleClick} className="cursor-pointer">
			<div className="relative h-[90px] w-[100px]">
				<div
					className={`before:rounded-b-0 before:rounded-l-0 absolute left-[50px] top-0 h-[80px] w-[50px] origin-[0_100%] -rotate-45 rounded-t-[50px] bg-primary content-[''] before:rounded-r-[50px] before:rounded-t-[50px]`}
				></div>
				<div
					className={`before:rounded-b-0 before:rounded-l-0 absolute left-0 top-0 h-[80px] w-[50px] origin-[100%_100%] rotate-45 rounded-r-[50px] rounded-t-[50px] bg-primary content-[''] before:rounded-r-[50px] before:rounded-t-[50px]`}
				></div>
				<div
					className="absolute inset-0 flex items-end justify-center overflow-hidden rounded-b-[50px] bg-red-500 transition-all duration-300 ease-in-out"
					style={{ height: `${fill}%` }}
				></div>
			</div>
		</div>
	)
}

export const HoverButton = () => {
	const [style, setStyle] = useState({ scale: 1, rotate: 0 })

	const handleMouseMove = (event: React.MouseEvent) => {
		const { left, width } = event.currentTarget.getBoundingClientRect()
		const x = event.pageX - left // Calculate cursor position within the button
		const relativeX = x / width - 0.5 // Normalize position: -0.5 to 0.5
		const scale = 1.2
		let rotate = 0

		// Decide rotation based on mouse position
		if (relativeX < -0.1) {
			// More to the left
			rotate = relativeX * 30 // Rotate left
		} else if (relativeX > 0.1) {
			// More to the right
			rotate = relativeX * 30 // Rotate right
		}

		setStyle({ scale, rotate })
	}

	const handleMouseLeave = () => {
		setStyle({ scale: 1, rotate: 0 }) // Reset to normal state
	}

	return (
		<motion.button
			className="cursor-pointer rounded bg-blue-500 px-6 py-2 text-white shadow"
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
			whileHover={{ scale: 1.2 }} // Ensure scale is applied during hover
			animate={style}
		>
			Hover Over Me
		</motion.button>
	)
}

export const HoverButton1 = () => {
	const [style, setStyle] = useState({ scale: 1, rotate: 0 })

	const handleMouseMove = (event: React.MouseEvent) => {
		const { left, width } = event.currentTarget.getBoundingClientRect()
		// 把坐标系调整至event.currentTarget
		const x = event.pageX - left // 相对于event.currentTarget的x坐标
		const center = width / 2
		const distanceFromCenter = x - center
		const scale = 1.05 // Scale up the heart shape on hover
		let rotate = 0 // Default no rotation

		// Determine rotation based on mouse position relative to center
		if (Math.abs(distanceFromCenter) > width * 0.2) {
			// Threshold at 30% of width
			rotate = distanceFromCenter * 0.2 // Scale rotation based on distance from center
		}

		setStyle({ scale, rotate })
	}

	const handleMouseLeave = () => {
		setStyle({ scale: 1, rotate: 0 }) // Reset to normal state when mouse leaves
	}

	return (
		<motion.svg
			// viewBox="0 0 20 20"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
			whileHover={{ scale: 1.1 }}
			animate={style}
		>
			<path
				fill-rule="evenodd"
				clip-rule="evenodd"
				d="M13.2537 0.0255029C23.4033 0.0255029 25.0273 10.5191 25.0273 10.5191C25.0273 10.5191 26.6512 -0.60088 37.6129 0.0255029C44.3441 0.410148 48.7484 6.32169 48.9804 12.1981C49.7924 32.7656 28.7678 41.5 25.0273 41.5C21.2868 41.5 -0.549833 32.3459 1.07416 12.1981C1.54782 6.32169 6.29929 0.0255029 13.2537 0.0255029Z"
				fill="currentColor"
			/>
		</motion.svg>
	)
}
