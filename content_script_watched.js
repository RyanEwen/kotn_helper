console.log('KotN Helper - Watched Listings')

// extension message handlers
const messageHandlers = {
    ENABLE_COMMS: (args) => {
        // send keepalives to the service worker as long as this page is open
        setInterval(() => {
            chrome.runtime.sendMessage({ action: 'KEEPALIVE' })
        }, 30000)

        // create script tag that adds inject_watched.js into the page
        const script = document.createElement('script')
        script.type = 'text/javascript'
        script.src = chrome.runtime.getURL('inject_watched.js')
        document.getElementsByTagName('head')[0].appendChild(script)

        console.log('KotN Helper - Comms enabled via this tab')
    },

    HIGHLIGHT_FRIEND_LISTING: (args) => {
        const listingEl = document.querySelector(`.listings-grid *[data-id="${args.listingId}"]`)

        if (!listingEl) {
            return
        }

        const div = listingEl.querySelector('.kotn-helper-friends-bidding') || document.createElement('div')
        div.className = 'kotn-helper-friends-bidding'
        div.innerHTML = `
            <details>
                <summary>Friends Bidding</summary>
                <ul>
                    ${args.friendsBids.map((bid) => `<li>${bid.bidder} ($${bid.bid})</li>`)}
                </ul>
            </details>
        `

        listingEl.querySelector('.listing-tile-middle').appendChild(div)
    },
}

// listen for extension messages
chrome.runtime.onMessage.addListener((message) => {
    if (message.action in messageHandlers) {
        messageHandlers[message.action](message.args)
    }
})

// listen for postMessages from inject_watched.js
window.addEventListener('message', (event) => {
    if (event.data.from != 'WATCHED_LISTINGS_INJECT_SCRIPT') {
        return
    }

    chrome.runtime.sendMessage(event.data.message)
})

// create style tag that adds inject_watched.css into the page
const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = chrome.runtime.getURL('inject_watched.css')
document.getElementsByTagName('head')[0].appendChild(link)

// tell the service worker that this tab is ready
chrome.runtime.sendMessage({ action: 'WATCHED_LISTINGS_OPENED' })
