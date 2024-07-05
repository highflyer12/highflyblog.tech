type ConvertKitSubscriber = {
	id: number
	first_name: string
	email_address: string
	state: 'active' | 'inactive'
	created_at: string
	fields: Record<string, string | null>
}

export async function getConvertKitSubscriber(email: string) {
	const url = new URL('https://api.convertkit.com/v3/subscribers')
	url.searchParams.set('email_address', email)
	url.searchParams.set(
		'api_secret',
		'2ekq6xWBOlk2fGlMmB9ywbFMaF7pEL9YUESEIjWuabo',
	)

	const response = await fetch(url.toString())
	const json = await response.json()
	console.log(json)

	const { subscribers: [subscriber = { state: 'inactive' }] = [] } = json as {
		subscribers?: Array<ConvertKitSubscriber>
	} // 把json当成 {subscribers?: Array<ConvertKitSubscriber>}类型，然后从json中结构出subscriber，并且在json为空数组时，给subscriber一个默认值{ state: 'inactive' }
	return subscriber
}

const subscriber = await getConvertKitSubscriber('mikeralemx3@gmail.com')

console.log(subscriber)

const json = {
	total_subscribers: 2,
	page: 1,
	total_pages: 1,
	subscribers: [
		{
			id: 123456,
			email_address: 'john@example.com',
			state: 'active',
			created_at: '2021-01-01T00:00:00Z',
			fields: {
				first_name: 'John',
				last_name: 'Doe',
			},
		},
		{
			id: 789012,
			email_address: 'jane@example.com',
			state: 'inactive',
			created_at: '2021-02-01T00:00:00Z',
			fields: {
				first_name: 'Jane',
				last_name: 'Doe',
			},
		},
	],
}

const json2 = json as { subscribers?: Array<ConvertKitSubscriber> }
console.log(json2)
