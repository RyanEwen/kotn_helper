;(async function () {
    function sendMessage(message) {
        window.postMessage({ to: 'COMMON_CONTENT_SCRIPT', message })
    }

    window.kotnHelperFns = {
        bid: (listingId, amount) => {
            if (!confirm(`Are you sure you want to bid $${amount}?`)) {
                return
            }

            sendMessage({ action: 'BID_CLICK', args: { listingId, amount } })
        },

        unwatch: (listingId) => {
            sendMessage({ action: 'UNWATCH_CLICK', args: { listingId } })
        },
    }

    sendMessage({ action: 'COMMON_SCRIPT_INJECTED' })
}())
