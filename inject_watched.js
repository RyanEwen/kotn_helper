(async function () {
    function forwardToContentScript(action, args) {
        window.postMessage({ from: 'WATCHED_LISTINGS_INJECT_SCRIPT', message: { action, args } })
    }

    // create an object similar to listingData but with the item name added-in (scraped from DOM)
    const listings = Object.fromEntries(Object.entries(listingData).map(([listingId, listing]) => {
        const listingEl = document.querySelector(`.listings-grid *[data-id="${listingId}"] .listing-tile-title-link`)

        return [listingId, { ...listing, id: listingId, name: listingEl.innerText }]
    }))

    // push username
    forwardToContentScript('WATCHED_LISTINGS_INJECTED', { username, listings })
}())
