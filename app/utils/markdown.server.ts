// markdown.server.ts这个文件用来处理一些简单的markdown加工，比如将markdown转换为html，去掉html标签等等

import { toString as hastToString } from 'hast-util-to-string'
import doc from 'rehype-document'
import format from 'rehype-format'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import markdown from 'remark-parse'
import remark2rehype from 'remark-rehype'
import { unified } from 'unified'

async function markdownToHtml(markdownString: string) {
	const result = await unified()
		.use(markdown)
		.use(remark2rehype)
		.use(rehypeStringify)
		.process(markdownString)

	return result.value.toString()
}
// <p>Hello, <strong>world</strong>!</p> ==> Hello, <strong>world</strong>! 即，去掉p标签
async function markdownToHtmlUnwrapped(markdownString: string) {
	const wrapped = await markdownToHtml(markdownString)
	return wrapped.replace(/(^<p>|<\/p>$)/g, '')
}

async function markdownToHtmlDocument(markdownString: string) {
	const result = await unified()
		.use(markdown)
		.use(remark2rehype)
		.use(doc)
		.use(format)
		.use(rehypeStringify)
		.process(markdownString)

	return result.value.toString()
}

async function stripHtml(htmlString: string) {
	const result = unified().use(rehypeParse).parse(htmlString)

	return hastToString(result)
}

export {
	markdownToHtml,
	markdownToHtmlUnwrapped,
	markdownToHtmlDocument,
	stripHtml,
}
