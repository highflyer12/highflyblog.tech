// refer https://github.com/kentcdodds/mdx-bundler/issues/203
import { slug } from 'github-slugger'
import { toString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'

export function remarkToc(options: any) {
	return (tree: any) =>
		visit(tree, 'heading', (node, index, parent) => {
			const text = toString(node)
			options.exportRef.push({
				text,
				url: `#${slug(text)}`,
				depth: node.depth,
			})
		})
}
