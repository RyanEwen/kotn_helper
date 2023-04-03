console.log('KotN Helper - Auctions')

// extension message handlers
const messageHandlers = {
    HIGHLIGHT_FRIEND_LISTING: (args) => {
        const listingEl = document.querySelector(`.listings-grid *[data-id="${args.listingId}"]`)

        if (!listingEl) {
            return
        }

        const div = listingEl.querySelector('.kotn-helper-friends-bidding') || document.createElement('div')
        div.className = 'kotn-helper-friends-bidding'
        div.innerHTML = `
            <details>
                <summary>Friend(s) Bidding</summary>
                <ul>
                    ${args.friendsBids.map((bid) => `<li>${bid.bidder} ($${bid.bid})</li>`).join('')}
                </ul>
            </details>
        `

        listingEl.querySelector('.listing-tile-middle').appendChild(div)
    },

    HIGHLIGHT_SPOUSE_LISTING: (args) => {
        const listingEl = document.querySelector(`.listings-grid *[data-id="${args.listingId}"]`)

        if (!listingEl) {
            return
        }

        const div = listingEl.querySelector('.kotn-helper-spouses-bidding') || document.createElement('div')
        div.className = 'kotn-helper-spouses-bidding'
        div.innerHTML = `
            <details>
                <summary>Spouse(s) Bidding</summary>
                <ul>
                    ${args.spousesBids.map((bid) => `<li>${bid.bidder} ($${bid.bid})</li>`).join('')}
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

// listen for postMessages from inject_auctions.js
window.addEventListener('message', (event) => {
    if (event.data.from != 'AUCTIONS_INJECT_SCRIPT') {
        return
    }

    chrome.runtime.sendMessage(event.data.message)
})

// create style tag that adds inject_auctions.css into the page
const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = chrome.runtime.getURL('inject_auctions.css')
document.getElementsByTagName('head')[0].appendChild(link)

// create script tag that adds inject_auctions.js into the page
const script = document.createElement('script')
script.type = 'text/javascript'
script.src = chrome.runtime.getURL('inject_auctions.js')
document.getElementsByTagName('head')[0].appendChild(script)

// tell the service worker that this tab is ready
chrome.runtime.sendMessage({ action: 'AUCTIONS_OPENED' })
