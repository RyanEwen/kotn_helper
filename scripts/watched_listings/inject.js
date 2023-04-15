;(async function () {
    function sendMessage(message) {
        window.postMessage({ to: 'WATCHED_LISTINGS_CONTENT_SCRIPT', message })
    }

    function sendMessageToCommon(message) {
        window.postMessage({ to: 'COMMON_CONTENT_SCRIPT', message })
    }

    // create an object similar to listingData but with the item name added-in (scraped from DOM)
    const listings = Object.fromEntries(Object.entries(listingData).map(([listingId, listing]) => {
        const listingEl = document.querySelector(`.listings-grid *[data-id="${listingId}"] .listing-tile-title-link`)

        return [listingId * 1, { ...listing, id: listingId * 1, name: listingEl.innerText }]
    }))

    sendMessage({ action: 'WATCHED_LISTINGS_SCRIPT_INJECTED', args: { username, listings }})

    sendMessageToCommon({ action: 'REQUEST_LISTING_DETAILS', args: { listingIds: Object.keys(listings).map((listingId) => listingId * 1) }})
}())
