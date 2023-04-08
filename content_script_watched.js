(async function () {
    // wait a bit in case per-page interrupts or something
    await new Promise((res) => { setTimeout(res, 250) })

    console.log('KotN Helper - Watched Listings')

    // extension message handlers
    const messageHandlers = {
        HIGHLIGHT_FRIEND_LISTING: async (args) => {
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
                        ${args.friendsBids.map((bid) => `<li>${bid.bidder} ($${bid.bid})</li>`).join('') }
                    </ul>
                </details>
            `

            listingEl.querySelector('.listing-tile-middle').appendChild(div)
        },

        HIGHLIGHT_SPOUSE_LISTING: async (args) => {
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
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (message.action in messageHandlers) {
            messageHandlers[message.action](message.args, sender).then((response) => {
                if (response) {
                    respond(response)
                }
            })
        }
    })


    // listen for postMessages from inject_any.js
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

    // create script tag that adds inject_watched.js into the page
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = chrome.runtime.getURL('inject_watched.js')
    document.getElementsByTagName('head')[0].appendChild(script)

    // tell the service worker that this tab is ready
    chrome.runtime.sendMessage({ action: 'WATCHED_LISTINGS_OPENED' })
}())
