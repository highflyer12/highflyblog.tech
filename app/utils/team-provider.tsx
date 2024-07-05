import React from 'react'
import { type OptionalTeam } from '../../types'
import { isTeam } from './misc'
import { createSimpleContext } from './providers'
import { useRootData } from './use-root-data'

export const teamEmoji: Record<OptionalTeam, string> = {
	RED: '🔴',
	BLUE: '🔵',
	YELLOW: '🟡',
	UNKNOWN: '⚪',
}

const { Provider: TeamProviderBase, useValue: useTeam } =
	createSimpleContext<
		[OptionalTeam, React.Dispatch<React.SetStateAction<OptionalTeam>>]
	>('Team')
export { useTeam }

export function TeamProvider({
	children,
}: {
	children: React.ReactNode | Array<React.ReactNode>
}) {
	const { user } = useRootData()
	const [team, setTeam] = React.useState<OptionalTeam>('UNKNOWN')

	// if the user logs out, we want to reset the team to unknown
	React.useEffect(() => {
		if (!user) setTeam('UNKNOWN')
	}, [user])
	// NOTE: calling set team will do nothing useful if we're given an actual team.【因为这种情况下value用的是user.team，而非team】
	return (
		<TeamProviderBase
			value={[user && isTeam(user.team) ? user.team : team, setTeam]}
		>
			{children}
		</TeamProviderBase>
	)
}
