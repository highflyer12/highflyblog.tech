//TODO - 实现页面滚动时，自动高亮当前页面对应的目录项【用intersectionObserver观察，如果有新的目录项出现在屏幕，则高亮改新的目录项】
//TODO - 实现目录项的滚动动画效果【点击目录项时，页面滚动到对应的位置】

import { Link } from '@remix-run/react'
import { useEffect, useState } from 'react'
import { type TocItem } from '../../types'

// NavLink component
const NavLink = ({ ...props }) => {
	const {
		children,
		href = '',
		className = '',
		active = '',
		currentHref = '',
	} = props

	const isActive = currentHref == href
	const activeClass = isActive ? active : ''

	return (
		<Link to={href} {...props} className={`${activeClass} ${className}`}>
			{children}
		</Link>
	)
}

export const Sidebar = ({ toc }: { toc: Array<TocItem> }) => {
	const [currentHref, setCurrentHref] = useState('')
	useEffect(() => {
		const observer = new IntersectionObserver(
			entries => {
				const visibleEntries = entries.filter(entry => entry.isIntersecting)
				if (visibleEntries.length > 0) {
					// Sort entries by their position in the viewport
					const sortedEntries = visibleEntries.sort(
						(a, b) =>
							a.target.getBoundingClientRect().top -
							b.target.getBoundingClientRect().top,
					)
					// Set the first visible entry as the current active link
					setCurrentHref(sortedEntries[0].target.getAttribute('href') ?? '')
				}
			},
			{ threshold: 0 }, // Adjust threshold to suit your needs
		)

		const interestedHashs = toc.map(item => item.url)
		const links = Array.from(document.querySelectorAll('a')).filter(link =>
			interestedHashs.includes(link?.getAttribute('href') ?? 'impossibleHash'),
		)
		links.forEach(link => {
			observer.observe(link)
		})

		return () => {
			links.forEach(link => {
				observer.unobserve(link)
			})
		}
	}, [toc])
	return (
		<>
			<nav className="fixed right-0 top-0 z-40 h-full w-full space-y-8 overflow-auto border-r bg-white sm:w-80">
				<div className="space-y-6 text-[0.9rem]">
					<>
						<div>
							<h3 className="px-4 pb-3 font-medium text-gray-800 md:px-8">
								Table of Contents
							</h3>
							<div className="px-4 text-gray-600 md:px-8">
								<ul>
									{toc?.map((item, idx) => (
										<li key={idx}>
											<NavLink
												href={item?.url}
												active="text-primary border-primary"
												className="block w-full border-l px-4 py-2 duration-150 hover:border-black hover:text-gray-900"
												currentHref={currentHref}
											>
												{item?.text}
											</NavLink>
										</li>
									))}
								</ul>
							</div>
						</div>
					</>
				</div>
			</nav>
		</>
	)
}
