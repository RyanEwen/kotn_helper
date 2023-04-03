// don't run this on the watched listings page
if (window.location.href.includes('listings/watched') == false) {
    console.log('KotN Helper - Listing')

    // extension message handlers
    const messageHandlers = {
        HIGHLIGHT_FRIEND_LISTING: (args) => {
            const listingEl = document.querySelector(`#listing-page .listing-content`)

            if (!listingEl) {
                return
            }

            const div = listingEl.querySelector('.kotn-helper-friends-bidding') || document.createElement('div')
            div.className = 'section kotn-helper-friends-bidding'
            div.innerHTML = `
                <details>
                    <summary>Friend(s) Bidding</summary>
                    <ul>
                        ${args.friendsBids.map((bid) => `<li>${bid.bidder} ($${bid.bid})</li>`).join('')}
                    </ul>
                </details>
            `

            listingEl.querySelector('.body .content').prepend(div)
        },

        HIGHLIGHT_SPOUSE_LISTING: (args) => {
            const listingEl = document.querySelector(`#listing-page .listing-content`)

            if (!listingEl) {
                return
            }

            const div = listingEl.querySelector('.kotn-helper-spouses-bidding') || document.createElement('div')
            div.className = 'section kotn-helper-spouses-bidding'
            div.innerHTML = `
                <details>
                    <summary>Spouse(s) Bidding</summary>
                    <ul>
                        ${args.spousesBids.map((bid) => `<li>${bid.bidder} ($${bid.bid})</li>`).join('')}
                    </ul>
                </details>
            `

            listingEl.querySelector('.body .content').prepend(div)
        },
    }

    // listen for extension messages
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action in messageHandlers) {
            messageHandlers[message.action](message.args)
        }
    })

    // listen for postMessages from inject_listing.js
    window.addEventListener('message', (event) => {
        if (event.data.from != 'LISTING_INJECT_SCRIPT') {
            return
        }

        chrome.runtime.sendMessage(event.data.message)
    })

    // create style tag that adds inject_listing.css into the page
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = chrome.runtime.getURL('inject_listing.css')
    document.getElementsByTagName('head')[0].appendChild(link)

    // create script tag that adds inject_listing.js into the page
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = chrome.runtime.getURL('inject_listing.js')
    document.getElementsByTagName('head')[0].appendChild(script)

    // tell the service worker that this tab is ready
    chrome.runtime.sendMessage({ action: 'LISTING_OPENED' })
}
