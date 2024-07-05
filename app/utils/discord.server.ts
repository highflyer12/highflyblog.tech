import { type User } from '@prisma/client'
import { type Team } from '../../types'
import { prisma } from './db.server'
import { getRequiredServerEnvVar, getTeam } from './misc'

const DISCORD_CLIENT_ID = getRequiredServerEnvVar('DISCORD_CLIENT_ID')
const DISCORD_CLIENT_SECRET = getRequiredServerEnvVar('DISCORD_CLIENT_SECRET')
const DISCORD_SCOPES = getRequiredServerEnvVar('DISCORD_SCOPES') //.e.g identify+guilds.join+email+guilds
const DISCORD_BOT_TOKEN = getRequiredServerEnvVar('DISCORD_BOT_TOKEN')
const DISCORD_GUILD_ID = getRequiredServerEnvVar('DISCORD_GUILD_ID') // 指的是discord里面epic web这个server的id
const DISCORD_RED_ROLE = getRequiredServerEnvVar('DISCORD_RED_ROLE')
const DISCORD_YELLOW_ROLE = getRequiredServerEnvVar('DISCORD_YELLOW_ROLE')
const DISCORD_BLUE_ROLE = getRequiredServerEnvVar('DISCORD_BLUE_ROLE')
const DISCORD_MEMBER_ROLE = getRequiredServerEnvVar('DISCORD_MEMBER_ROLE')

const discordRoleTeams: {
	[Key in Team]: string
} = {
	RED: DISCORD_RED_ROLE,
	YELLOW: DISCORD_YELLOW_ROLE,
	BLUE: DISCORD_BLUE_ROLE,
}
type DiscordUser = {
	id: string
	username: string
	discriminator: string
	avatar?: string
}
type DiscordMember = { user: DiscordUser; roles: Array<string> }
type DiscordToken = {
	token_type: string
	access_token: string
}
type DiscordError = { message: string; code: number }

export async function sendMessageFromDiscordBot(
	channelId: string,
	content: string,
) {
	await fetchAsDiscordBot(`channels/${channelId}/messages`, {
		method: 'POST',
		body: JSON.stringify({ content }),
		headers: { 'Content-Type': 'application/json' },
	})
}

// "as a bot" means that the actions are being performed by a bot account rather than a human user account.
async function fetchAsDiscordBot(endpoint: string, config?: RequestInit) {
	const url = new URL(`https://discord.com/api/${endpoint}`)
	const res = await fetch(url.toString(), {
		...config,
		headers: {
			Authorization: `Bot ${DISCORD_BOT_TOKEN}`, // bot token is typically generated when you create a bot on the Discord Developer Portal.
			...config?.headers,
		},
	})
	return res
}

async function fetchJsonAsDiscordBot<JsonType = unknown>(
	endpoint: string,
	config?: RequestInit,
) {
	const res = await fetchAsDiscordBot(endpoint, {
		...config,
		headers: {
			'Content-Type': 'application/json',
			...config?.headers,
		},
	})
	const json = (await res.json()) as JsonType
	return json
}

export async function getDiscordUser(discordUserId: string) {
	const user = await fetchJsonAsDiscordBot<DiscordUser>(
		`users/${discordUserId}`,
	)
	return user
}

// fetches a member object from a specific guild.
// a "member" refers to a user who is part of a specific server, has properties related to their status within the server, such as their server-specific nickname, roles, mute/deafen status, and join date, in addition to their global user properties like username, avatar, and user ID.
export async function getMember(discordUserId: string) {
	const member = await fetchJsonAsDiscordBot<DiscordMember | DiscordError>(
		`guilds/${DISCORD_GUILD_ID}/members/${discordUserId}`,
	)
	return member
}

// 涉及两个方面的数据更新：一是自己应用的数据库中添加用户的discord Id；二是根据用户选择的team，在discord中为用户添加角色【比如，我在discord的角色是：blue team, member, epicweb.dev】
async function updateDiscordRolesForUser(
	discordMember: DiscordMember,
	user: User,
) {
	await prisma.user.update({
		where: { id: user.id },
		data: { discordId: discordMember.user.id },
	})

	const team = getTeam(user.team)
	if (!team) {
		return
	}
	const teamRole = discordRoleTeams[team]

	if (!discordMember.roles.includes(teamRole)) {
		await fetchAsDiscordBot(
			`guilds/${DISCORD_GUILD_ID}/members/${discordMember.user.id}`,
			{
				method: 'PATCH',
				body: JSON.stringify({
					roles: Array.from(
						new Set([...discordMember.roles, DISCORD_MEMBER_ROLE, teamRole]),
					),
				}),
				// note using fetchJsonAsDiscordBot because this API doesn't return JSON.
				headers: {
					'Content-Type': 'application/json',
				},
			},
		)
	}
}

export async function connectDiscord({
	user,
	code,
	domainUrl,
}: {
	user: User
	code: string
	domainUrl: string
}) {
	// 先是拿授权码code获取token以及相关的用户信息【所谓的授权码，是用户授予我的应用访问/操作用户在discord的用户信息权限，即用户给第三方授权 】
	const { discordUser, discordToken } = await getUserToken({ code, domainUrl })

	await addUserToDiscordServer(discordUser, discordToken)

	// give the server bot a little time to handle the new user
	// it's not a disaster if the bot doesn't manage to handle it
	// faster, but it's better if the bot adds the right roles etc
	// before we retrieve the member.
	await new Promise(resolve => setTimeout(resolve, 300)) // "sleep" or pause execution for 300 milliseconds (which is 0.3 seconds) in JavaScript or TypeScript. It's similar to the `sleep` function in languages like Python or Bash, but JavaScript doesn't have a built-in `sleep` function.

	const discordMember = await getMember(discordUser.id)
	if ('user' in discordMember) {
		await updateDiscordRolesForUser(discordMember, user)
	} else if ('message' in discordMember) {
		throw new Error(
			`Discord Error (${discordMember.code}): ${discordMember.message}`,
		)
	}

	return discordMember
}

/** oauth flow!! Your application can use the access token to make API requests on behalf of the user. refer: https://discord.com/developers/docs/topics/oauth2
 * 1. The first step in implementing OAuth2 is registering a developer application and retrieving your client ID and client secret.【在discord上获取个人应用的clientId和client secret】
 * 2. 按下按钮之后，Your application redirects the user to the authorization server (Discord's login page). The redirect URL includes query parameters specifying your client ID, the scopes of access your application is requesting, and a redirect URI that the authorization server will send the user back to after they authorize your application.
 * 下面的网址是网站上join discord按钮的链接：
 * https://discord.com/api/oauth2/authorize?client_id=738096608440483870&redirect_uri=https%3A%2F%2Fkentcdodds.com%2Fdiscord%2Fcallback&response_type=code&scope=identify+guilds.join+email+guilds
 * 3. The user logs in and authorizes your application.【用户登录并授权你的应用】
 * 4. The authorization server redirects the user back to your application with an authorization code.【授权服务器将用户重定向回你的应用，并提供一个授权码】
 * 5. discord redirect回到应用的callback routes，在这个routes里面，你的应用使用授权码交换访问令牌【也就是说，获取授权码之后，就可以call connectDiscord这个函数了。】
 */
async function getUserToken({
	code, // authorization_code
	domainUrl,
}: {
	code: string
	domainUrl: string
}) {
	const tokenUrl = new URL('https://discord.com/api/oauth2/token')
	// here we're using the URLSearchParams class to create a query string from an object, and encodes it as application/x-www-form-urlencoded formData.
	const params = new URLSearchParams({
		client_id: DISCORD_CLIENT_ID,
		client_secret: DISCORD_CLIENT_SECRET,
		grant_type: 'authorization_code',
		code,
		redirect_uri: `${domainUrl}/discord/callback`, // a redirect URI that the authorization server will send the user back to after they authorize your application.
		scope: DISCORD_SCOPES, // the scopes of access your application is requesting
	})

	const tokenRes = await fetch(tokenUrl.toString(), {
		method: 'POST',
		body: params,
		// In accordance with the relevant RFCs, the token and token revocation URLs will only accept a content type of application/x-www-form-urlencoded. JSON content is not permitted and will return an error.
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
	})

	const discordToken = (await tokenRes.json()) as DiscordToken

	const userUrl = new URL('https://discord.com/api/users/@me')
	const userRes = await fetch(userUrl.toString(), {
		headers: {
			authorization: `${discordToken.token_type} ${discordToken.access_token}`,
		},
	})
	const discordUser = (await userRes.json()) as DiscordUser

	return { discordUser, discordToken }
}

// inviting a user to join a specific server. 【比如，我的discord就加入了epic web、remix、midjourney等server，每个server下面有好多channels】discord把server也叫guild
async function addUserToDiscordServer(
	discordUser: DiscordUser,
	discordToken: DiscordToken,
) {
	// there's no harm inviting someone who's already in the server,
	// so we invite them without bothering to check whether they're in the
	// server already
	await fetchAsDiscordBot(
		`guilds/${DISCORD_GUILD_ID}/members/${discordUser.id}`,
		{
			method: 'PUT',
			body: JSON.stringify({ access_token: discordToken.access_token }),
			headers: { 'Content-Type': 'application/json' },
		},
	)
}
