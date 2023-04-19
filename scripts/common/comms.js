; (async function () {
    function sendMessage(message) {
        window.postMessage({ to: 'COMMON_CONTENT_SCRIPT', message })
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
            .on('App\\Events\\BidPlaced', (channel, args) => sendMessage({ action: 'BID_PLACED', args }))
            .on('App\\Events\\WatchStateChanged', (channel, args) => sendMessage({ action: 'WATCH_STATE_CHANGED', args }))
            .on('App\\Events\\BidderOutbid', (channel, args) => sendMessage({ action: 'OUTBID', args }))
            .on('App\\Events\\ItemWon', (channel, args) => sendMessage({ action: 'ITEM_WON', args }))

        socket.on('connect', () => {
            socket.emit('subscribe', { channel: 'public', auth: { headers } })
            socket.emit('subscribe', { channel: `private-user.${authUserId}`, auth: { headers } })

            sendMessage({ action: 'WS_CONNECTED' })
        })

        socket.on('reconnecting', () => {
            sendMessage({ action: 'WS_RECONNECTING' })
        })

        socket.on('reconnect_error', () => {
            sendMessage({ action: 'WS_RECONNECT_ERROR' })
        })

        socket.on('reconnect_failed', () => {
            sendMessage({ action: 'WS_RECONNECT_FAIL' })
        })

        socket.on('disconnect', () => {
            sendMessage({ action: 'WS_DISCONNECTED' })
        })
    }
}())
