import nodePath from 'node:path'
import { throttling } from '@octokit/plugin-throttling'
import { Octokit as createOctokit } from '@octokit/rest'
import { type GitHubFile } from '../../types'

const safePath = (s: string) => s.replace(/\\/g, '/')
const Octokit = createOctokit.plugin(throttling)

const octokit = new Octokit({
	auth: process.env.GITHUB_TOKEN,
	throttle: {
		onRateLimit: (retryAfter, options) => {
			const method = 'method' in options ? options.method : 'METHOD_UNKNOWN'
			const url = 'url' in options ? options.url : 'URL_UNKNOWN'
			console.warn(
				`Request quota exhausted for request ${method} ${url}. Retrying after ${retryAfter} seconds.`,
			)

			return true
		},
		onSecondaryRateLimit: (retryAfter, options) => {
			const method = 'method' in options ? options.method : 'METHOD_UNKNOWN'
			const url = 'url' in options ? options.url : 'URL_UNKNOWN'
			// does not retry, only logs a warning
			octokit.log.warn(`Abuse detected for request ${method} ${url}`)
		},
	},
})

export async function downloadDirList(path: string) {
	const resp = await octokit.repos.getContent({
		owner: 'highflyer12',
		repo: 'highflyblog.tech',
		path: path,
		ref: 'main',
	})

	const data = resp.data
	if (!Array.isArray(data)) {
		throw new Error(
			`Tried to download content from ${path}. GitHub did not return an array of files. This should never happen...`,
		)
	}
	return data
}

export async function downloadFile(path: string) {
	const resp = await octokit.repos.getContent({
		owner: 'highflyer12',
		repo: 'highflyblog.tech',
		path: path,
		ref: 'main',
	})

	const data = resp.data
	if ('content' in data && 'encoding' in data) {
		const encoding = data.encoding as Parameters<typeof Buffer.from>['1']
		return Buffer.from(data.content, encoding).toString()
	}

	console.error(data)
	throw new Error(
		`Tried to get ${path} but got back something that was unexpected. It doesn't have a content or encoding property`,
	)
}

export async function downloadFirstMdxFile(
	list: Array<{ name: string; path: string; type: string; sha: string }>,
) {
	const fileOnly = list.filter(file => file.type === 'file')
	for (const extension of ['.mdx', 'md']) {
		const file = fileOnly.find(file => file.name.endsWith(extension))
		if (file) {
			return downloadFileBySha(file.sha)
		}
	}
	return null
}

async function downloadFileBySha(sha: string) {
	const resp = await octokit.git.getBlob({
		owner: 'highflyer12',
		repo: 'highflyblog.tech',
		file_sha: sha,
	})
	const data = resp.data
	const encoding = data.encoding as Parameters<typeof Buffer.from>['1']
	return Buffer.from(data.content, encoding).toString()
}

export async function downloadDirectory(
	dir: string,
): Promise<Array<GitHubFile>> {
	const files = await downloadDirList(dir)
	const fileContents = await Promise.all(
		files.map(async file => {
			if (file.type === 'file') {
				return {
					path: safePath(file.path),
					content: await downloadFile(file.path),
				}
			} else {
				return downloadDirectory(file.path)
			}
		}),
	)
	return fileContents.flat()
}

/**
 *
 * @param relativeMdxFileOrDirectory the path to the content. For example:
 * content/workshops/react-fundamentals.mdx (pass "workshops/react-fudnamentals")
 * content/workshops/react-hooks/index.mdx (pass "workshops/react-hooks")
 * @returns A promise that resolves to an Array of GitHubFiles for the necessary files
 */
export async function downloadMdxFileOrDirectory(
	relativeMdxFileOrDirectory: string,
): Promise<{ entry: string; files: Array<GitHubFile> }> {
	// mdxFileOrDirectory: content/blog/2018-in-review.mdx 或者 content/blog/aha-testing
	const mdxFileOrDirectory = `content/${relativeMdxFileOrDirectory}`

	// full path = nodePath.dirname + nodePath.basename
	const parentDir = nodePath.dirname(mdxFileOrDirectory) // 'content/blog'
	const dirList = await downloadDirList(parentDir)

	const basename = nodePath.basename(mdxFileOrDirectory)
	const mdxFileWithoutExt = nodePath.parse(mdxFileOrDirectory).name
	const potentials = dirList.filter(({ name }) => name.startsWith(basename))
	const exactMatch = potentials.find(
		({ name }) => nodePath.parse(name).name === mdxFileWithoutExt,
	)
	const dirPotential = potentials.find(({ type }) => type === 'dir') // find first dir

	// 先尝试直接找mdx文件，如果没有找到，再找文件夹
	const content = await downloadFirstMdxFile(
		exactMatch ? [exactMatch] : potentials,
	)
	let files: Array<GitHubFile> = []
	let entry = mdxFileOrDirectory
	if (content) {
		// technically you can get the blog post by adding .mdx at the end... Weird
		// but may as well handle it since that's easy...
		entry = mdxFileOrDirectory.endsWith('.mdx')
			? mdxFileOrDirectory
			: `${mdxFileOrDirectory}.mdx`
		// /content/about.mdx => entry is about.mdx, but compileMdx needs
		// the entry to be called "/content/index.mdx" so we'll set it to that
		// because this is the entry for this path
		files = [
			{
				path: safePath(nodePath.join(mdxFileOrDirectory, 'index.mdx')),
				content,
			},
		]
	} else if (dirPotential) {
		entry = dirPotential.path
		files = await downloadDirectory(mdxFileOrDirectory)
	}
	return { entry, files }
}
