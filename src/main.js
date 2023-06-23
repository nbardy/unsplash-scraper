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
                        await requestQueue.addRequest({ url: `${url}&page=${page}`, userData: {query}});
                    }
                    log.info(`Generated ${totalPages} URLs.`);
                } catch (error) {
                    throw new Error(`addToQueue: ${error}`);
                }
            };

            await addToQueue();
        }

        const crawler = new Apify.BasicCrawler({
            requestQueue,
            handleRequestFunction: async ({ request }) => {
                log.info(`Processing: ${request.url}`);
                let { body } = await requestAsBrowser(request);
                const query = request.userData.query;
                
                body = JSON.parse(body);

                body.results.forEach((photo) => Apify.pushData({imageUrl: photo, query: query}));                
            },
        });

        await crawler.run();

    } catch (error) {
        log.error(error);
    }
});

