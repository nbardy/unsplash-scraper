const Apify = require('apify')

let collection = "demo"

const getURLs = async () => {
	try {
		const input = await Apify.getInput()
		const keyword = input.keyword.replace(/\s+/g, '-').trim().toLowerCase()
		collection = keyword
		let url = `https://unsplash.com/napi/search/photos?query=${keyword}&per_page=30`
		if(input.color) url += `&color=${input.color}`
		
		const response = await Apify.utils.requestAsBrowser({url})
		const body = JSON.parse(response.body)
		const totalPages = body.total_pages
		let urls = []
		for(let page = 1; page <= totalPages; page++) {
			urls.push({url: `${url}&page=${page}`})
		}
		return urls
	} catch(error) {
		console.error(error)
	}
}


Apify.main(async () => {
	let results = {}
	try {
		const store = await Apify.openKeyValueStore('photos')
		const requestList = await Apify.openRequestList('start-urls', await getURLs())
		const crawler = new Apify.BasicCrawler({
			requestList,
			handleRequestFunction: async ({ request }) => {
				const response = await Apify.utils.requestAsBrowser(request)
				const body = JSON.parse(response.body)
				body.results.forEach(image => {
					results[image.id] = image
				})	
			}
		})
		await crawler.run()
		await store.setValue(collection, results )
	} catch(error) {
		console.error(error)
	} finally {
		// const used = process.memoryUsage().heapUsed / 1024 / 1024
		// console.info('\x1b[32m', `Memory: ${used.toFixed(2)} MB`)
		results = null
	}
})
