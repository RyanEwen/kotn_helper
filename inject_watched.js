(function() {
    function forwardToContentScript(action, args) {
        window.postMessage({ from: 'WATCHED_LISTINGS_INJECT_SCRIPT', message: { action, args } })
    }

    // create an object similar to listingData but with the item name added-in (scraped from DOM)
    const watchedListings = Object.fromEntries(Object.entries(listingData).map(([listingId, listing]) => {
        const listingEl = document.querySelector(`.listings-grid *[data-id="${listingId}"] .listing-tile-title-link`)

        return [listingId, { ...listing, id: listingId, name: listingEl.innerText }]
    }))

    // push some basic user info and watched listing names
    forwardToContentScript('WATCHED_LISTINGS_CONNECTED', { userId, username, watchedListings })

    // bind to socketio public channel
    window.Echo.channel('public')
        .listen('BidPlaced', (message) => forwardToContentScript('BID_PLACED', message))

    // bind to socketio user channel
    window.Echo.private(`user.${authUserId}`)
        .listen('WatchStateChanged', (message) => forwardToContentScript('WATCH_STATE_CHANGED', message))
        .listen('BidderOutbid', (message) => forwardToContentScript('OUTBID', message))
        .listen('ItemWon', (message) => forwardToContentScript('ITEM_WON', message))
}())
