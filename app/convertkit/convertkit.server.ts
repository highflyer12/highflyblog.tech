// refer this: https://developers.convertkit.com/#planning-your-integration

import { getRequiredServerEnvVar } from '../utils/misc.tsx'

const CONVERT_KIT_API_KEY = getRequiredServerEnvVar('CONVERT_KIT_API_KEY') // All API calls require the api_key parameter. You can find your API Key in the ConvertKit Account page.
const CONVERT_KIT_API_SECRET = getRequiredServerEnvVar('CONVERT_KIT_API_SECRET') //Some API calls require the api_secret parameter. All calls that require api_key also work with api_secret, there's no need to use both. This key grants access to sensitive data and actions on your subscribers.

type ConvertKitSubscriber = {
	id: number
	first_name: string
	email_address: string
	state: 'active' | 'inactive'
	created_at: string
	fields: Record<string, string | null>
}

type ConvertKitTag = {
	id: string
	name: string
	created_at: string
}

// 根据email获取特定的subscriber【即通过email获取subscriber，从而得到更多用户信息】
export async function getConvertKitSubscriber(email: string) {
	const url = new URL('https://api.convertkit.com/v3/subscribers')
	url.searchParams.set('email_address', email) // 本来上面的api是用来Returns a list of your subscribers的。但是可以通过email_address参数来获取特定的subscriber
	url.searchParams.set('api_secret', CONVERT_KIT_API_SECRET)

	const response = await fetch(url.toString())
	const json = await response.json() // 这里json长这样：{ total_subscribers: 0, page: 1, total_pages: 1, subscribers: [] }

	const { subscribers: [subscriber = { state: 'inactive' }] = [] } = json as {
		subscribers?: Array<ConvertKitSubscriber>
	} // 把json转换成 {subscribers?: Array<ConvertKitSubscriber>}类型，然后从json中结构出subscriber，并且在json为空数组时，给subscriber一个默认值{ state: 'inactive' }
	return subscriber.state === 'active' ? subscriber : null
}

export async function getConvertKitSubscriberTags(
	subscriberId: ConvertKitSubscriber['id'],
) {
	const url = new URL(
		`https://api.convertkit.com/v3/subscribers/${subscriberId}/tags`,
	)
	url.searchParams.set('api_secret', CONVERT_KIT_API_SECRET)

	const resp = await fetch(url.toString())
	const json = (await resp.json()) as {
		tags: Array<ConvertKitTag>
	}
	return json.tags
}

export async function ensureSubscriber({
	email,
	firstName,
}: {
	email: string
	firstName: string
}) {
	let subscriber = await getConvertKitSubscriber(email)
	if (!subscriber) {
		// this is a basic form that doesn't really do anything. It's just a way to
		// get the users on the mailing list
		subscriber = await addSubscriberToForm({
			email,
			firstName,
			convertKitFormId: '2500372',
		})
	}

	return subscriber
}

// Subscribe an email address to one of your forms.
export async function addSubscriberToForm({
	email,
	firstName,
	convertKitFormId,
}: {
	email: string
	firstName: string
	convertKitFormId: string
}) {
	const subscriberData = {
		api_key: CONVERT_KIT_API_KEY,
		api_secret: CONVERT_KIT_API_SECRET,
		first_name: firstName,
		email,
	}

	// this is a basic form that doesn't really do anything. It's just a way to
	// get the users on the mailing list
	const response = await fetch(
		`https://api.convertkit.com/v3/forms/${convertKitFormId}/subscribe`,
		{
			method: 'POST',
			body: JSON.stringify(subscriberData),
			headers: { 'Content-Type': 'application/json' },
		},
	)
	const json = (await response.json()) as {
		subscription: { subscriber: ConvertKitSubscriber }
	}
	return json.subscription.subscriber
}

export async function addTagToSubscriber({
	email,
	firstName,
	convertKitTagId,
}: {
	email: string
	firstName: string
	convertKitTagId: string
}) {
	await ensureSubscriber({ email, firstName })
	const subscriberData = {
		api_key: CONVERT_KIT_API_KEY,
		api_secret: CONVERT_KIT_API_SECRET,
		first_name: firstName,
		email,
	}

	const subscribeUrl = `https://api.convertkit.com/v3/tags/${convertKitTagId}/subscribe`
	const response = await fetch(subscribeUrl, {
		method: 'POST',
		body: JSON.stringify(subscriberData),
		headers: {
			'Content-Type': 'application/json',
		},
	})
	const json = (await response.json()) as {
		subscription: { subscriber: ConvertKitSubscriber }
	}
	return json.subscription.subscriber
}

export async function tagKCDSiteSubscriber({
	email,
	firstName,
	fields,
}: {
	email: string
	firstName: string
	fields: Record<string, string>
}) {
	const subscriber = await getConvertKitSubscriber(email)
	const kcdTagId = '2466369'
	const kcdSiteForm = '2393887'
	const subscriberData = {
		api_key: CONVERT_KIT_API_KEY,
		api_secret: CONVERT_KIT_API_SECRET,
		first_name: firstName,
		email,
		fields,
	}
	// the main difference in subscribing to a tag and subscribing to a
	// form is that in the form's case, the user will get a double opt-in
	// email before they're a confirmed subscriber. So we only add the
	// tag to existing subscribers who have already confirmed.
	// This form auto-adds the tag to new subscribers
	const subscribeUrl = subscriber
		? `https://api.convertkit.com/v3/tags/${kcdTagId}/subscribe`
		: `https://api.convertkit.com/v3/forms/${kcdSiteForm}/subscribe`
	const updatedRes = await fetch(subscribeUrl, {
		method: 'POST',
		body: JSON.stringify(subscriberData),
		headers: {
			'Content-Type': 'application/json',
		},
	})
	const updatedJson = (await updatedRes.json()) as {
		subscription: { subscriber: ConvertKitSubscriber }
	}
	return updatedJson.subscription.subscriber
}
