(function() {
    function forward(type, args, globals) {
        window.postMessage({ from: 'KotNHelper', type, args, globals })
    }

    function listenAndForward(public, events) {
        const socket = public ? window.Echo.channel('public') : window.Echo.private(`user.${authUserId}`)

        events.forEach(event => {
            socket.listen(event, args => {
                forward(event, args, { listingData })
            })
        })
    }

    // public events
    listenAndForward(true, [
        // 'AuctionStarted',
        // 'AuctionEnded',
        // 'BidPlaced',
    ])

    // private events
    listenAndForward(false, [
        'WatchStateChanged',
        'BidderOutbid',
        'ItemWon',
        // 'MessageSentToMember',
        // 'UnreadMessageCountChanged',
    ])
}())
