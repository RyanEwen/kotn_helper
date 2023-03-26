(function() {
    function forward(type, args) {
        window.postMessage({ from: 'KOTN_HELPER', type, args })
    }

    forward('PAGE_LOAD', { listingData })

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
