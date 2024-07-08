import { Link, NavLink } from '@remix-run/react'
import clsx from 'clsx'
import { type TocItem } from '../../types'

// Component to render each table of contents entry
const TocEntry = ({ item }: { item: TocItem }) => (
	<li style={{ marginLeft: `${(item.depth - 2) * 20}px` }}>
		<Link to={item.url}>{item.text}</Link>
	</li>
)

// Main Table of Contents component
export const TableOfContents = ({ toc }: { toc: Array<TocItem> }) => {
	return (
		<div>
			<h1>Table of Contents</h1>
			<ul>
				{toc.map((item, index) => (
					<TocEntry key={index} item={item} />
				))}
			</ul>
		</div>
	)
}
