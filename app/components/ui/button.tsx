import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '#app/utils/misc.tsx'

// cva定义一些基础的css样式，以及在variants对象中定义一系列可变样式
const buttonVariants = cva(
	'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors outline-none focus-visible:ring-2 focus-within:ring-2 ring-ring ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary/80',
				destructive:
					'bg-destructive text-destructive-foreground hover:bg-destructive/80',
				outline:
					'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
				secondary:
					'bg-secondary text-secondary-foreground hover:bg-secondary/80',
				ghost: 'hover:bg-accent hover:text-accent-foreground',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-10 px-4 py-2',
				wide: 'px-24 py-5',
				sm: 'h-9 rounded-md px-3',
				lg: 'h-11 rounded-md px-8',
				pill: 'px-12 py-3 leading-3',
				icon: 'h-10 w-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
)

// * Extends two types: React.ButtonHTMLAttributes<HTMLButtonElement> + VariantProps<typeof buttonVariants>【多重继承，逗号隔开】，同时加上一个optional property asChild.
export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		// cva offers the VariantProps helper to extract variant types from the variants object.
		VariantProps<typeof buttonVariants> {
	asChild?: boolean
}

// 关于asChild和Slot：The Slot component acts as a transparent wrapper.It doesn’t render an actual DOM element itself; instead, it passes its props down to its children.
// This allows any child components to inherit styles and attributes from their parent while maintaining their native functionality and semantics.
// *【当asChild为true时，Button这个组件实际上render的是childComponent，只是为了通过Slot组件将相关的属性传递给child】【例：<Button variant="link" asChild><Link to="/">Home</Link></Button>就是将Link样式变为Button variant="link"的样式，这样可以保留Link的semantic！】
// * React.forwardRef这个wrapper函数的作用就是将ref传递给内部的DOM元素，这样可以在外部通过ref.current来访问到内部的DOM元素。
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'button'
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		)
	},
)
Button.displayName = 'Button'

export { Button, buttonVariants }
