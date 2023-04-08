(async function () {
    function forwardToContentScript(action, args) {
        window.postMessage({ from: 'LISTING_INJECT_SCRIPT', message: { action, args } })
    }

    const name = document.querySelector('.listing-content .header h1').innerText

    // push listing info
    forwardToContentScript('LISTING_INECTED', { listing: { ...listing, name, bids: initialBids }})
}())
