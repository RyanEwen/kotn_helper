;(async function () {
    // wait a bit in case per-page override interrupts loading
    await new Promise((res) => { setTimeout(res, 250) })

    console.log('KotN Helper - Watched Listings')

    window.listingFns = {
        listingIconParentEl: (listingId) => {
            return document.querySelector(`.listings-grid *[data-id="${listingId}"] .listing-tile-middle`)
        },

        hasSpecialCondition: (listingId) => {
            return document.querySelector(`.listings-grid *[data-id="${listingId}"] .listing-tile-condition .condition-alert`) != null
        }
    }

    // inject.js postMessage handlers
    const postMessageHandlers = {
        WATCHED_LISTINGS_SCRIPT_INJECTED: ({ username, listings }) => {
            chrome.runtime.sendMessage({ action: 'WATCHED_LISTINGS_SCRIPT_INJECTED', args: { username, listings } })
        },
    }

    // listen for postMessages from scripts/watched_listings/inject.js
    window.addEventListener('message', (event) => {
        if (event.data.to != 'WATCHED_LISTINGS_CONTENT_SCRIPT') {
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
        console.log('Watch Listings Received', message, sender?.tab?.id)

        if (message.action in messageHandlers) {
            messageHandlers[message.action](message.args, sender).then((response) => {
                if (response) {
                    respond(response)
                }
            })
        }

        return true // needed to return asynchronously
    })

    // inject styles
    commonFns.injectStyles('scripts/watched_listings/inject.css')

    // inject script
    commonFns.injectScript('scripts/watched_listings/inject.js')

    // tell the service worker that this tab is ready
    chrome.runtime.sendMessage({ action: 'WATCHED_LISTINGS_OPENED' })
}())
