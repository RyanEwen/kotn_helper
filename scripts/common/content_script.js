;(async function () {
    // wait a bit in case per-page override interrupts loading
    await new Promise((res) => { setTimeout(res, 125) })

    console.log('KotN Helper - Common')

    window.commonData = {
        listingIds: [],
        listingIdsProcessed: [],
        friends: [],
        spouses: [],
    }

    window.commonFns = {
        injectScript: (name) => {
            const script = document.createElement('script')
            script.type = 'text/javascript'
            script.src = chrome.runtime.getURL(name)
            document.getElementsByTagName('head')[0].appendChild(script)
        },

        injectStyles: (name) => {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = chrome.runtime.getURL(name)
            document.getElementsByTagName('head')[0].appendChild(link)
        },

        showProcessing: (html) => {
            const existingDiv = document.querySelector('.kotn-helper-processing')
            const div = existingDiv || document.createElement('div')

            div.innerHTML = html

            if (!existingDiv) {
                div.className = 'kotn-helper-processing'
                document.body.appendChild(div)
                setTimeout(() => div.classList.add('visible'), 100)
            } else {
                div.classList.add('visible')
            }
        },

        hideProcessing: () => {
            const div = document.querySelector('.kotn-helper-processing')

            setTimeout(() => div.classList.remove('visible'), 3000)
        },

        createDetailsEl: (parent, className, summary, body) => {
            let el = parent.querySelector(`.${className.split(' ').join('.')}`)

            if (!el) {
                el = document.createElement('details')
                el.className = className
                el.addEventListener('mouseenter', () => { el.open = true })
                el.addEventListener('mouseleave', () => { el.open = false })

                parent.appendChild(el)
            }

            el.innerHTML = `<summary>${summary}</summary>${body}`

            return el
        },

        renderPriceIcon: (parent, iconHtml, bodyHtml) => {
            return commonFns.createDetailsEl(parent, 'kotn-helper-icon kotn-helper-price-icon', iconHtml, bodyHtml)
        },

        renderBidsIcon: (parent, iconHtml, bodyHtml) => {
            return commonFns.createDetailsEl(parent, 'kotn-helper-icon kotn-helper-bids-icon', iconHtml, bodyHtml)
        },

        renderOthersBiddingIcon: (parent, iconHtml, bodyHtml) => {
            return commonFns.createDetailsEl(parent, 'kotn-helper-icon kotn-helper-others-bidding', iconHtml, bodyHtml)
        },

        enableComms: async (args) => {
            setInterval(() => chrome.runtime.sendMessage({ action: 'KEEPALIVE' }), 15000)

            commonFns.injectScript('scripts/common/inject.js')

            console.log('KotN Helper - Comms enabled via this tab')
        },

        scrapeNameFromListing: async ({ html, listingId }) => {
            const parser = new DOMParser()
            const dom = parser.parseFromString(html, 'text/html')

            return dom.querySelector('.listing-content .header h1').innerText
        },

        scrapeNamesFromListings: async ({ html, listingIds }) => {
            const parser = new DOMParser()
            const dom = parser.parseFromString(html, 'text/html')

            return Object.fromEntries(listingIds.map((listingId) => {
                const listingEl = dom.querySelector(`.listings-grid *[data-id="${listingId}"] .listing-tile-title-link`)

                return [listingId, listingEl.innerText.trim()]
            }))
        },
    }

    // extension message handlers
    const messageHandlers = {
        ENABLE_COMMS: async (args) => {
            return commonFns.enableComms(args)
        },

        SCRAPE_NAME_FROM_LISTING: async (args) => {
            return commonFns.scrapeNameFromListing(args)
        },

        SCRAPE_NAMES_FROM_LISTINGS: async (args) => {
            return commonFns.scrapeNamesFromListings(args)
        },

        PUSH_LISTING_DETAILS: async ({ listingId, bids, name }) => {
            // ignore data that isn't relevant (happens if service worker is still fetching data after tab changes pages)
            if (commonData.listingIds.includes(listingId) == false) {
                return
            }

            const parentEl = listingFns.listingIconParent(listingId)
            const currentBid = Big(bids[0].bid || 0).toFixed(2)
            const currentBidFee = Big(currentBid).times(0.1).toFixed(2)
            const currentBidPlusFee = Big(currentBid).plus(currentBidFee).toFixed(2)
            const currentBidPlusFeeTax = Big(currentBidPlusFee).times(0.13).toFixed(2)
            const currentBidPlusFeePlusTax = Big(currentBidPlusFee).plus(currentBidPlusFeeTax).toFixed(2)

            commonFns.renderPriceIcon(
                parentEl,
                `$${currentBidPlusFeePlusTax}`,
                `
                    Bid: $${currentBid}<br />
                    Fee: $${currentBidFee}<br />
                    Tax: $${currentBidPlusFeeTax}
                `
            )

            // defined in auctions/listing/watched_listings scripts
            commonFns.renderBidsIcon(
                parentEl,
                `${bids.length} bids`,
                `<ul>${bids.map((bid) => `<li>$${bid.bid} • ${bid.bidder}</li>`).join('')}</ul>`
            )

            // keep track of processed listings
            if (commonData.listingIdsProcessed.includes(listingId.toString()) == false) {
                commonData.listingIdsProcessed.push(listingId.toString())

                // update progress toast
                commonFns.showProcessing(`Looked up ${commonData.listingIdsProcessed.length} of ${commonData.listingIds.length} listings`)

                // hide toast if finished
                if (commonData.listingIdsProcessed.length == commonData.listingIds.length) {
                    commonFns.hideProcessing()
                }
            }

            const friendsBids = (bids || []).filter((bid) => commonData.friends.includes(bid.bidder))
            const spousesBids = (bids || []).filter((bid) => commonData.spouses.includes(bid.bidder))

            if (friendsBids.length) {
                // defined in auctions/listing/watched_listings scripts
                const el = commonFns.renderOthersBiddingIcon(
                    parentEl,
                    `Friend(s) ${friendsBids[0].bid == bids[0].bid ? 'Winning' : 'Bidding'}`,
                    `<ul>${friendsBids.map((bid) => `<li>$${bid.bid} • ${bid.bidder}</li>`).join('')}</ul>`
                )

                el.classList.add('friend')
            }

            if (spousesBids.length) {
                // defined in auctions/listing/watched_listings scripts
                const el = commonFns.renderOthersBiddingIcon(
                    parentEl,
                    `Spouse(s) ${spousesBids[0].bid == bids[0].bid ? 'Winning' : 'Bidding'}`,
                    `<ul>${spousesBids.map((bid) => `<li>$${bid.bid} • ${bid.bidder}</li>`).join('')}</ul>`
                )

                el.classList.add('spouse')
            }
        },
    }

    // listen for extension messages
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
        // console.log('Common Received', message, sender?.tab?.id)

        if (message.action in messageHandlers) {
            messageHandlers[message.action](message.args, sender).then((response) => {
                if (response) {
                    respond(response)
                }
            })
        }
    })

    // inject.js postMessage handlers
    const postMessageHandlers = {
        COMMON_SCRIPT_INJECTED: () => {
            chrome.runtime.sendMessage({ action: 'COMMON_SCRIPT_INJECTED' })
        },

        REQUEST_LISTING_DETAILS: ({ listingIds }) => {
            commonData.listingIds = listingIds

            listingIds.forEach((listingId) => {
                const parentEl = listingFns.listingIconParent(listingId)
                commonFns.renderPriceIcon(parentEl, '...', 'Loading...')
                commonFns.renderBidsIcon(parentEl, '...', 'Loading...')
            })

            commonFns.showProcessing(`Looking up ${listingIds.length} listings`)

            chrome.runtime.sendMessage({ action: 'REQUEST_LISTING_DETAILS', args: { listingIds } })
        },
    }

    // listen for postMessages from scripts/common/inject.js
    window.addEventListener('message', (event) => {
        if (event.data.to != 'COMMON_CONTENT_SCRIPT') {
            return
        }

        if (event.data.message.action in postMessageHandlers) {
            postMessageHandlers[event.data.message.action](event.data.message.args)
        } else {
            chrome.runtime.sendMessage(event.data.message)
        }

        // console.log('Common Sending', event.data.message)
    })

    // cache friend names
    const storedData = await chrome.storage.sync.get(['options.friends.names', 'options.spouses.names'])
    commonData.friends = (storedData['options.friends.names'] || '').trim().split("\n")
    commonData.spouses = (storedData['options.spouses.names'] || '').trim().split("\n")

    // inject styles
    commonFns.injectStyles('scripts/common/inject.css')

    // tell the service worker that this tab is ready
    chrome.runtime.sendMessage({ action: 'COMMON_OPENED' })
}())
