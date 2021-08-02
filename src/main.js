const Apify = require('apify');

const { log, requestAsBrowser } = Apify.utils;

Apify.main(async () => {
    log.info('Starting Scraper...');
    try {
        const { keyword, color } = await Apify.getInput();
        const query = keyword.trim().toLowerCase().replace(/\s+/g, '-'); // Need to Fix: Normalize query
        const url = `https://unsplash.com/napi/search/photos?query=${query}&color=${color}&per_page=30`;

        // Generate List
        const getRequestList = async () => {
            try {
                log.info('Generating Requests List...');
                const response = await requestAsBrowser({ url });
                const body = JSON.parse(response.body);
                const totalPages = body.total_pages;
                const urls = [];
                for (let page = 1; page <= totalPages; page++) {
                    urls.push(`${url}&page=${page}`);
                }
                log.info(`Generated ${urls.length} URLs.`);
                return urls;
            } catch (error) {
                log.error(error);
            }
        };

        // Crawl the URLs
        const requestList = new Apify.RequestList({
            sources: await getRequestList(),
            persistStateKey: 'urls',
        });
        await requestList.initialize();
        const photos = [];
        const crawler = new Apify.BasicCrawler({
            requestList,
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
        await store.setValue(`${query}__${color}`, photos);
        log.info(`${photos.length} photos processed`);
    } catch (error) {
        log.error(error);
    }
});
