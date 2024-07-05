import { type LoaderFunctionArgs } from '@remix-run/node'
import { getBlogJson } from '../utils/blog.server'

export async function loader({ request }: LoaderFunctionArgs) {
	const data = await getBlogJson(request)
	console.log(data)
	const string = JSON.stringify(data)
	return new Response(string, {
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': String(Buffer.byteLength(string)),
		},
	})
}
