import { Actor, BasicCrawler } from 'apify';
import { ApifyStorageLocal } from '@apify/storage-local';

const LAST_PROCESSED_INDEX_KEY = `LAST_PROCESSED_INDEX_${Actor.getEnv().actorRunId}`; // Uses the run ID in the key name

Actor.main(async () => {
    const proxyConfiguration = await Actor.createProxyConfiguration();
    console.info('Starting Scraper...');
    try {
        const { keywords, orientation, color, resumeRequestQueueId } = await Actor.getInput();
        const keywordList = keywords.split(';').map(kw => kw.trim().toLowerCase().replace(/\s+/g, '-')); // Normalize queries

        // Retrieve the last processed keyword index from the default key-value store
        let lastProcessedIndex = await Actor.getValue(LAST_PROCESSED_INDEX_KEY);
        if (!lastProcessedIndex) {
            lastProcessedIndex = 0;
        }
        console.info("lastProcessIndex: ", lastProcessedIndex)
        let requestQueue;
        
        if(resumeRequestQueueId != null) {         
            // Resume
            requestQueue = await Actor.openRequestQueue(resumeRequestQueueId);
        } else {
            requestQueue = await Actor.openRequestQueue();
            // Loading keywords
            for (let i = lastProcessedIndex; i < keywordList.length; i++) {
                const query = keywordList[i];
                console.info("Processin query: ", query)
    
                let url = `https://unsplash.com/napi/search/photos?query=${query}&per_page=30`;
                if (orientation !== 'any') url += `&orientation=${orientation}`;
                if (color !== 'any') url += `&color=${color}`;
    
                // Generate Queue
                const addToQueue = async ({ sendRequest }) => {
                    try {
                        console.info('Adding to Queue...');
                        const res = await sendRequest({ url, responseType: 'json' });
                        const proxyUrl = proxyConfiguration.newUrl();
                        
                        if (res.body.errors) throw res.body.errors;
                        const totalPages = res.body.total_pages;
                        for (let page = 1; page <= totalPages; page++) {
                            await requestQueue.addRequest({ url: `${url}&page=${page}`, userData: {query}});
                        }
                        console.info(`Generated ${totalPages} URLs.`);
                    } catch (error) {
                        throw new Error(`addToQueue: ${error}`);
                    }
                };
    
                await addToQueue();
    
                // Store the index of the last processed keyword in the default key-value store
                await Actor.setValue(LAST_PROCESSED_INDEX_KEY, i + 1);
            }
        }

        const crawler = new BasicCrawler({
            requestQueue,
            async requestHandler({ sendRequest, request, log }) {
                try {
                    
                    log.info(`Processing: ${request.url}`);
                    const proxyUrl = proxyConfiguration.newUrl();
                    
                    const res = await sendRequest({ url: request.url, responseType: 'json' });
                    const query = request.userData.query;
    
                    // Check if res.body.results exists before mapping over it
                    if (res.body.results) {
                        // Create an array to hold all items to be pushed
                        const itemsToPush = res.body.results.map((photo) => ({ imageUrl: photo, query: query }));
            
                        // Push all items in a single call
                        await Actor.pushData(itemsToPush);
    
                        log.info(`Found ${itemsToPush.length} items`)
                    } else {
                        log.warning(`No results found in body for URL: ${request.url}`, res.body);
                    }      
                }
            },
        });

        await crawler.run();

    } catch (error) {
        console.error(error);
    }
});
