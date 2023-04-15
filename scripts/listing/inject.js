;(async function () {
    function sendMessage(message) {
        window.postMessage({ to: 'LISTING_CONTENT_SCRIPT', message })
    }

    function sendMessageToCommon(message) {
        window.postMessage({ to: 'COMMON_CONTENT_SCRIPT', message })
    }

    const name = document.querySelector('.listing-content .header h1').innerText

    sendMessage({ action: 'LISTING_INECTED', args: { listing: { ...listing, name, bids: initialBids } } })

    sendMessageToCommon({ action: 'REQUEST_LISTING_DETAILS', args: { listingIds: [ listing.id ] } })
}())
