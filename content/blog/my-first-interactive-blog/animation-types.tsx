import { motion } from 'framer-motion'

import React from 'react'
import { useInView } from 'react-intersection-observer'
import { useDebounce as useDebouncedValue } from './components.ts'

import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '#app/components/ui/card'

import { Slider } from '#app/components/ui/slider'

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
		<Card>
			<CardHeader>
				<CardTitle>Spring</CardTitle>
			</CardHeader>
			<CardContent>
				<div>
					<div>
						<p>Mass: {mass}</p>
						<Slider defaultValue={[mass]} max={30} step={1} />
					</div>
					<div>
						<p>Mass: {damping}</p>
						<Slider defaultValue={[stiffness]} max={30} step={1} />
					</div>
					<div>
						<p>Mass: {mass}</p>
						<Slider
							defaultValue={[damping]}
							max={30}
							step={1}
							value={[damping]}
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
