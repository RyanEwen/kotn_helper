(function() {
    function forward(action, args) {
        window.postMessage({ from: 'AUCTIONS', message: { action, args } })
    }

    // push some basic user info and watched listing names
    forward('AUCTIONS_PAGE_LOADED')
}())
