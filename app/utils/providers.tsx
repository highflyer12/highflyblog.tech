import { useMatches } from '@remix-run/react'
import React from 'react'
import { type KCDHandle } from '#types'

export function useMatchLoaderData<LoaderData>(handleId: string) {
	const matches = useMatches()
	const match = matches.find(
		({ handle }) => (handle as KCDHandle | undefined)?.id === handleId,
	)
	if (!match) {
		throw new Error(`No active route has a handle ID of ${handleId}`)
	}
	return match.data as LoaderData
}

// This utility is handy, but in Remix apps these days you really shouldn't need
// context all that much. Instead you can useOutletContext: https://reactrouter.com/en/main/hooks/use-outlet-context
// React Context is a powerful tool that allows you to share values between components without having to explicitly pass props through every level of the tree

/** 
 my note:
	1. React context is great when you are passing data that can be used in any component in your application. 【Data should be placed on React context that does not need to be updated often.】Think of React context as the equivalent of global variables for our React components.
	2.  Four steps to using React context: 
		1)Create context using the createContext method;【The created context is an object with two properties: Provider and Consumer, both of which are components.】 
		2)Take your created context and wrap the context provider around your component tree; 
		[OptionalTeam, React.Dispatch<React.SetStateAction<OptionalTeam>>]
		3)Put any value you like on your context provider using the value prop; 【Provider可以通过value provide任意的数据！比如在team-provider里面，value={[team, setTeam]}，因此contextType定义为[OptionalTeam, React.Dispatch<React.SetStateAction<OptionalTeam>>]】
		4)Read that value within any component by using the context consumer.
	The context object itself does not hold any information. It represents which context other components read or provide. Typically, you will use:
	SomeContext.Provider in components above to specify the context value;
	call useContext(SomeContext) in components below to read it。
  e.g:
	<ThemeContext.Provider value={theme}>
      <AuthContext.Provider value={currentUser}>
        <Page />
      </AuthContext.Provider>
    </ThemeContext.Provider>
  Now the Page component and any components inside it, no matter how deep, will “see” the passed context values. If the passed context values change, React will re-render the components reading the context as well.
 */

// 基于上述分析，我们创建比如TeamProvider之后，就可以通过下面的函数，用useTeam()来获取value={[team, setTeam]}，而不需要在每个组件里面传递props，而且这个useTeam()可以在任何地方使用。【前提是TeamProvider包裹住App】
export function createSimpleContext<ContextType>(name: string) {
	// ContextType取决于value的数据类型，比如在team-provider里面，value={[team, setTeam]}，因此contextType定义为[OptionalTeam, React.Dispatch<React.SetStateAction<OptionalTeam>>]
	// unique symbol for this context, serves as a unique identifier to determine if the context has been properly provided with a meaningful value or not.
	// If a component tries to consume this context and receives the defaultValue, it indicates that the context is being accessed outside of a proper provider
	const defaultValue = Symbol(`Default ${name} context value`) //no two symbols are the same, even if they have the same description
	const Context = React.createContext<ContextType | null | typeof defaultValue>(
		defaultValue,
	)
	Context.displayName = name

	function useValue() {
		const value = React.useContext(Context) // call useContext(SomeContext) in components below to read the context value
		if (value === defaultValue) {
			// indicates that the context is being accessed outside of a proper provider
			throw new Error(`use${name} must be used within ${name}Provider`)
		}
		//比如<Context.Provider value={null}>。。。</Context.Provider>
		if (!value) {
			throw new Error(
				`No value in ${name}Provider context. If the value is optional in this situation, try useOptional${name} instead of use${name}`,
			)
		}
		return value
	}

	function useOptionalValue() {
		const value = React.useContext(Context)
		if (value === defaultValue) {
			throw new Error(`useOptional${name} must be used within ${name}Provider`)
		}
		return value
	}

	return { Provider: Context.Provider, useValue, useOptionalValue }
}
