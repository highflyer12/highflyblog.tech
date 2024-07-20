import { styled } from '@maximeheckel/design-system'
import { motion } from 'framer-motion'

import React from 'react'
import { useInView } from 'react-intersection-observer'
import { useDebounce as useDebouncedValue } from './components.ts'

export const TransitionGridWrapper = styled('div', {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
	gridGap: '32px',

	'@media (max-width: 950px)': {
		padding: '0',
	},

	'> div': {
		width: '100%',
		maxWidth: '400px',
		marginLeft: 'auto',
		marginRight: 'auto',
	},
})

export const AnimationCardContent = styled('div', {
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	justifyContent: 'space-around',
	height: '475px',
	padding: '12px 0px',
})

export const HighlightedValue = styled('div', {
	borderRadius: 'var(--border-radius-0)',
	backgroundColor: 'var(--primary)',
	color: 'var(--accent)',
	border: '2px solid var(--accent)',
	padding: '2px 6px',
	fontFamily: 'var(--font-mono)',
	fontSize: 'var(--font-size-1)',
	display: 'inline-flex',
	justifyContent: 'center',
	lineHeight: '1rem',
})

export const Wrapper = styled('div', {
	margin: '30px 0px',

	'@media (min-width: 1100px)': {
		position: 'relative',
		maxWidth: '1000px',
		width: 'calc(100% + 300px)',
		margin: '30px -150px',
	},
})

export const Form = styled('form', {
	margin: '20px 0',
	width: '70%',
	zIndex: '1',
	display: 'flex',
	flexDirection: 'column',
	justifyContent: 'space-around',
	fontSize: '14px',

	label: {
		marginBottom: '8px',
	},

	input: {
		marginBottom: '24px',
	},

	select: {
		border: '1px solid var(--accent)',
		boxShadow: 'none',
		backgroundColor: 'var(--primary)',
		color: 'var(--accent)',
		height: '30px',
		borderRadius: 'var(--border-radius-0)',
		padding: '5px',
	},
})

export const AnimationTypes = () => {
	// The useInView hook makes it easy to monitor the inView state of your components. Call the useInView hook with the (optional) options you need. It will return an array containing a ref, the inView status and the current entry. Assign the ref to the DOM element you want to monitor, and the hook will report the status.
	const [ref, inView] = useInView()
	const [tweenAnimation, setTweenAnimation] = React.useState('easeInOut')
	const [mass, setMass] = React.useState(3)
	const [damping, setDamping] = React.useState(1)
	const [velocity, setVelocity] = React.useState(50)
	const [stiffness, setStiffness] = React.useState(100)
	const [countSpring, setCountSpring] = React.useState(0)
	const [countInertia, setCountInertia] = React.useState(0)

	const debouncedMass = useDebouncedValue(mass, 300)
	const debouncedStiffness = useDebouncedValue(stiffness, 300)
	const debouncedDamping = useDebouncedValue(damping, 300)
	const debouncedVelocity = useDebouncedValue(velocity, 300)

	return (
		<>
			<motion.div
				key={countSpring}
				style={{
					background: 'linear-gradient(90deg,#ffa0ae 0%,#aacaef 75%)',
					height: '100px',
					width: '100px',
					borderRadius: '10px',
				}}
				initial={{
					y: -100,
				}}
				animate={
					inView
						? {
								y: 0,
							}
						: {
								y: -100,
							}
				}
				transition={{
					type: 'spring',
					stiffness,
					mass,
					damping,
				}}
			/>
			<div className="h-4 w-4 bg-red-500">Hello tailwindcss</div>
		</>
	)
}
