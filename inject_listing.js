(function() {
    function forwardToContentScript(action, args) {
        window.postMessage({ from: 'LISTING_INJECT_SCRIPT', message: { action, args } })
    }

    // create an object similar to listingData but with the item name added-in (scraped from DOM)
    const listingEl = document.querySelector(`#listing-page .listing-content .header`)

    const listingObj = { ...listing, name: listingEl.innerText, bids: initialBids }

    // push some basic user info and watched listing names
    forwardToContentScript('LISTING_LOADED', { userId: user.id, username: user.username, listing: listingObj })
}())
