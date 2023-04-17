;(async function () {
    // wait a bit in case per-page override interrupts loading
    await new Promise((res) => { setTimeout(res, 250) })

    // don't run this on the watched listings page
    if (window.location.href.includes('listings/watched')) {
        return
    }

    console.log('KotN Helper - Listing')

    window.listingFns = {
        listingIconParentEl: (listingId) => {
            return document.querySelector(`#listing-page .listing-content .body .carousel-inner`)
        },

        hasSpecialCondition: (listingId) => {
            return false // no need to show the note on this page
        }
    }

    // inject.js postMessage handlers
    const postMessageHandlers = {
        LISTING_SCRIPT_INJECTED: ({ listing }) => {
            chrome.runtime.sendMessage({ action: 'LISTING_SCRIPT_INJECTED', args: { listing } })
        },
    }

    // listen for postMessages from scripts/watched_listings/inject.js
    window.addEventListener('message', (event) => {
        if (event.data.to != 'LISTING_CONTENT_SCRIPT') {
            return
        }

        if (event.data.message.action in postMessageHandlers) {
            postMessageHandlers[event.data.message.action](event.data.message.args)
        }
    })

    // extension message handlers
    const messageHandlers = {
        BID_PLACED: async (args) => {
            if (commonData.listingIds.includes(args.listing_id)) {
                chrome.runtime.sendMessage({ action: 'REQUEST_LISTING_DETAILS', args: { listingIds: [args.listing_id] } })
            }
        },
    }

    // listen for extension messages
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        console.log('Listing Received', message, sender?.tab?.id)

        if (message.action in messageHandlers) {
            messageHandlers[message.action](message.args, sender).then((response) => {
                if (response) {
                    respond(response)
                }
            })
        }
    })

    // inject styles
    commonFns.injectStyles('scripts/listing/inject.css')

    // inject script
    commonFns.injectScript('scripts/listing/inject.js')

    // tell the service worker that this tab is ready
    chrome.runtime.sendMessage({ action: 'LISTING_OPENED' })
}())
