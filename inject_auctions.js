(function() {
    function forwardToContentScript(action, args) {
        window.postMessage({ from: 'AUCTIONS_INJECT_SCRIPT', message: { action, args } })
    }

    // create an object similar to listingData but with the item name added-in (scraped from DOM)
    const listings = Object.fromEntries(Object.entries(listingData).map(([listingId, listing]) => {
        const listingEl = document.querySelector(`.listings-grid *[data-id="${listingId}"] .listing-tile-title-link`)

        return [listingId, { ...listing, id: listingId, name: listingEl.innerText }]
    }))

    // push some basic user info and watched listing names
    forwardToContentScript('AUCTIONS_LOADED', { userId, username, listings })
}())
