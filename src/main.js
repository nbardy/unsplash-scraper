const Apify = require('apify');
const { log, requestAsBrowser } = Apify.utils;

Apify.main(async () => {
    log.info('Starting Scraper...');
    try {
        const { keywords, orientation, color } = await Apify.getInput();
        const keywordList = keywords.split(';').map(kw => kw.trim().toLowerCase().replace(/\s+/g, '-')); // Normalize queries

        // Create a RequestQueue
        const requestQueue = await Apify.openRequestQueue();

        for (const query of keywordList) {
            let url = `https://unsplash.com/napi/search/photos?query=${query}&per_page=30`;
            if (orientation !== 'any') url += `&orientation=${orientation}`;
            if (color !== 'any') url += `&color=${color}`;

            // Generate Queue
            const addToQueue = async () => {
                try {
                    log.info('Adding to Queue...');
                    const response = await requestAsBrowser({ url });
                    const body = JSON.parse(response.body);
                    if (body.errors) throw body.errors;
                    const totalPages = body.total_pages;
                    for (let page = 1; page <= totalPages; page++) {
                        await requestQueue.addRequest({ url: `${url}&page=${page}` });
                    }
                    log.info(`Generated ${totalPages} URLs.`);
                } catch (error) {
                    throw new Error(`addToQueue: ${error}`);
                }
            };

            await addToQueue();
        }

        // Crawl the URLs
        const photos = [];
        const crawler = new Apify.BasicCrawler({
            requestQueue,
            handleRequestFunction: async ({ request }) => {
                log.info(`Processing: ${request.url}`);
                let { body } = await requestAsBrowser(request);
                body = JSON.parse(body);
                body.results.forEach((photo) => photos.push(photo));
            },
        });

        await crawler.run();

        // Save photos
        const store = await Apify.openKeyValueStore('unsplash');
        for (const query of keywordList) {
            await store.setValue(`${query}__${color}__${orientation}`, photos);
            log.info(`${photos.length} photos processed for keyword: ${query}`);
        }
    } catch (error) {
        log.error(error);
    }
});
