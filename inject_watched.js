(function() {
    function forward(action, args) {
        window.postMessage({ from: 'WATCHED_LISTINGS', message: { action, args } })
    }

    // create an object similar to listingData but with the item name added-in (scraped from DOM)
    const watchedListings = Object.fromEntries(Object.entries(listingData).map(([listingId, listing]) => {
        const listingEl = document.querySelector(`.listings-grid *[data-id="${listingId}"] .listing-tile-title-link`)

        return [listingId, { ...listing, name: listingEl.innerText }]
    }))

    // push some basic user info and watched listing names
    forward('WATCHED_LISTINGS_CONNECTED', { userId, username, watchedListings })

    window.Echo.channel('public')
        .listen('BidPlaced', (message) => forward('BID_PLACED', message))

    window.Echo.private(`user.${authUserId}`)
        .listen('WatchStateChanged', (message) => forward('WATCH_STATE_CHANGED', message))
        .listen('BidderOutbid', (message) => forward('OUTBID', message))
        .listen('ItemWon', (message) => forward('ITEM_WON', message))
}())
