(async function () {
    // wait a bit in case per-page interrupts or something
    await new Promise((res) => { setTimeout(res, 250) })

    console.log('KotN Helper - Any')

    // extension message handlers
    const messageHandlers = {
        ENABLE_COMMS: async (args) => {
            // send keepalives to the service worker as long as this page is open
            setInterval(() => {
                chrome.runtime.sendMessage({ action: 'KEEPALIVE' })
            }, 15000)

            // create script tag that adds inject_any.js into the page
            const script = document.createElement('script')
            script.type = 'text/javascript'
            script.src = chrome.runtime.getURL('inject_any.js')
            document.getElementsByTagName('head')[0].appendChild(script)

            console.log('KotN Helper - Comms enabled via this tab')
        },

        SCRAPE_LISTING_NAME: async (html) => {
            const parser = new DOMParser()
            const dom = parser.parseFromString(html, 'text/html')

            return dom.querySelector('.listing-content .header h1').innerText
        },

        SCRAPE_LISTING_NAMES: async ({ html, listings }) => {
            const parser = new DOMParser()
            const dom = parser.parseFromString(html, 'text/html')

            return Object.fromEntries(Object.entries(listings).map(([listingId, listing]) => {
                const listingEl = dom.querySelector(`.listings-grid *[data-id="${listingId}"] .listing-tile-title-link`)

                return [listingId, { ...listing, name: listingEl.innerText.trim() }]
            }))
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
        if (event.data.from != 'ANY_INJECT_SCRIPT') {
            return
        }

        chrome.runtime.sendMessage(event.data.message)
    })

    // tell the service worker that this tab is ready
    chrome.runtime.sendMessage({ action: 'ANY_OPENED' })
}())
