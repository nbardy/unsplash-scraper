const Apify = require('apify');

const { log, requestAsBrowser } = Apify.utils;

Apify.main(async () => {
    try {
        const { keyword, color } = await Apify.getInput();
        const query = keyword.trim().toLowerCase().replace(/\s+/g, '-'); // Need to Fix: Normalize query

        // Collect photos
        const results = [];
        let page = 1;
        let completed = false;
        while (!completed) {
            const url = `https://unsplash.com/napi/search/photos?query=${query}&color=${color}&per_page=30&page=${page++}`;
            const response = await requestAsBrowser({ url });
            const body = JSON.parse(response.body);
            if (!body.results.length) completed = true;
            else {
                log.info(`Scraping: ${url}`);
                body.results.forEach((image) => results.push(image));
            }
        }

        // Save photos
        const store = await Apify.openKeyValueStore('unsplash');
        await store.setValue(`${query}__${color}`, results);
        log.info(`${results.length} photos processed`);
    } catch (error) {
        log.error(error);
    }
});
