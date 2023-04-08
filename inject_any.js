(async function () {
    function forwardToContentScript(action, args) {
        window.postMessage({ from: 'ANY_INJECT_SCRIPT', message: { action, args } })
    }

    // connect to websockets
    if (authUserId) {
        const apiToken = document.querySelector('meta[name=api-token]').getAttribute('content')
        const csrfToken = document.querySelector('meta[name=csrf-token]').getAttribute('content')

        const headers = {
            'Authorization': `Bearer ${apiToken}`,
            'X-CSRF-TOKEN': csrfToken,
        }

        const socket = io(`wss://${window.location.hostname}:8443`, {
            transports: ['websocket'],
            extraHeaders: headers,
            reconnection: true,
            reconnectionDelay: 500,
            maxReconnectionAttempts: Infinity,
        })

        socket
            .on('App\\Events\\BidPlaced', (channel, message) => forwardToContentScript('BID_PLACED', message))
            .on('App\\Events\\WatchStateChanged', (channel, message) => forwardToContentScript('WATCH_STATE_CHANGED', message))
            .on('App\\Events\\BidderOutbid', (channel, message) => forwardToContentScript('OUTBID', message))
            .on('App\\Events\\ItemWon', (channel, message) => forwardToContentScript('ITEM_WON', message))

        socket.on('connect', () => {
            socket.emit('subscribe', { channel: 'public', auth: { headers } })
            socket.emit('subscribe', { channel: `private-user.${authUserId}`, auth: { headers } })

            forwardToContentScript('WS_CONNECTED')
        })

        socket.on('reconnecting', () => {
            forwardToContentScript('WS_RECONNECTING')
        })

        socket.on('reconnect_error', () => {
            forwardToContentScript('WS_RECONNECT_ERROR')
        })

        socket.on('reconnect_failed', () => {
            forwardToContentScript('WS_RECONNECT_FAIL')
        })

        socket.on('disconnect', () => {
            forwardToContentScript('WS_DISCONNECTED')
        })
    }

    forwardToContentScript('ANY_INJECTED')
}())
