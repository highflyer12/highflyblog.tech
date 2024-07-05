import { clsx } from 'clsx'
import * as React from 'react'

interface GridProps {
	children: React.ReactNode // represent any thing that can be rendered in React
	overflow?: boolean
	className?: string
	as?: React.ElementType
	id?: string
	nested?: boolean
	rowGap?: boolean
	featured?: boolean
}

/**
 * refer: https://www.bekk.christmas/post/2023/24/useref-and-forwardref
 * 【主要讲了useRef只可以用来做html element，比如input的属性：<input ref={someRef}> 。对于自定义的component，由于ref是保留的关键字，ref prop不可用：比如<CustomInput ref={inputRef} />，inputRef会一直是null。解决的办法就是用React.forwardRef对自定义component进行包装，然后即可正常使用ref】
 * 语法：React.forwardRef<自定义compoennt的类型, 自定义compoennt的props类型>
 */
export const Grid = React.forwardRef<HTMLElement, GridProps>(function Grid(
	{ children, className, as: Tag = 'div', featured, nested, rowGap, id },
	ref,
) {
	return (
		<Tag
			ref={ref}
			id={id}
			className={clsx('relative', {
				'mx-10vw': !nested,
				'w-full': nested,
				'py-10 md:py-24 lg:pb-40 lg:pt-36': featured,
			})} // 前面是className，后面是条件
		>
			{/*对于featured，添加灰色的圆角背景*/}
			{featured ? (
				<div className="-mx-5vw absolute inset-0">
					<div className="max-w-8xl mx-auto h-full w-full rounded-lg bg-secondary" />
				</div>
			) : null}{' '}
			<div
				className={clsx(
					'relative grid grid-cols-4 gap-x-4 md:grid-cols-8 lg:grid-cols-12 lg:gap-x-6',
					{
						'mx-auto max-w-7xl': !nested,
						'gap-y-4 lg:gap-y-6': rowGap,
					},
					className,
				)}
			>
				{children}
			</div>
		</Tag>
	)
})
