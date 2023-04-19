;(async function () {
    function sendMessage(message) {
        window.postMessage({ to: 'COMMON_CONTENT_SCRIPT', message })
    }

    window.kotnHelperFns = {
        bid: (listingId, amount) => {
            sendMessage({ action: 'BID_CLICK', args: { listingId, amount } })
        },
    }

    sendMessage({ action: 'COMMON_SCRIPT_INJECTED' })
}())
