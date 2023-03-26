(function() {
    function forward(type, args) {
        window.postMessage({ from: 'KOTN_HELPER', type, args })
    }

    const watchedListings = {}

    Object.keys(listingData).forEach((listingId) => {
        const listingEl = document.querySelector(`.listings-grid *[data-id="${listingId}"] .listing-tile-title-link`)

        watchedListings[listingId] = { ...listingData, name: listingEl.innerText }
    })

    forward('PAGE_LOAD', { watchedListings })

    window.Echo.channel('public').listen('BidPlaced', message => {
        forward('BID_PLACED', { ...message, listingData })
    })

    window.Echo.private(`user.${authUserId}`).listen('WatchStateChanged', message => {
        forward('WATCH_STATE_CHANGED', { ...message, listingData })
    })

    window.Echo.private(`user.${authUserId}`).listen('BidderOutbid', message => {
        forward('OUTBID', { ...message, listingData })
    })

    window.Echo.private(`user.${authUserId}`).listen('ItemWon', message => {
        forward('ITEM_WON', { ...message, listingData })
    })

    // window.Echo.private(`user.${authUserId}`).listen('MessageSentToMember', message => {
    //     forward('MESSAGE_SENT_TO_MEMBER', message)
    // })

    // window.Echo.private(`user.${authUserId}`).listen('UnreadMessageCountChanged', message => {
    //     forward('UNREAD_MESSAGE_COUNT_CHANGED', message)
    // })
}())
