;(async function () {
    // wait a bit in case per-page override interrupts loading
    await new Promise((res) => { setTimeout(res, 125) })

    console.log('KotN Helper - Common')

    window.commonData = {
        listingIds: [],
        listingIdsProcessed: [],
        friends: [],
        spouses: [],
        username: null,
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

        createDetailsEl: (parentEl, className, summaryHtml, bodyHtml) => {
            let el = parentEl.querySelector(`.${className.split(' ').join('.')}`)

            if (!el) {
                el = document.createElement('details')
                el.className = className
                el.addEventListener('mouseenter', () => { el.open = true })
                el.addEventListener('mouseleave', () => { el.open = false })

                parentEl.appendChild(el)
            }

            el.innerHTML = `<summary>${summaryHtml}</summary>${bodyHtml}`

            return el
        },

        renderSidebarEl: (html) => {
            const className = 'kotn-helper-sidebar'
            let el = document.body.querySelector(`.${className}`)

            if (!el) {
                el = document.createElement('div')
                el.className = className

                const handleEl = document.createElement('span')
                handleEl.className = 'kotn-helper-sidebar-handle'
                handleEl.innerHTML = 'Watched Listings'

                const listingsEl = document.createElement('span')
                listingsEl.className = 'kotn-helper-sidebar-listings'
                listingsEl.innerHTML = html

                handleEl.addEventListener('click', () => { document.body.classList.toggle('kotn-helper-sidebar-open') })

                el.appendChild(handleEl)
                el.appendChild(listingsEl)

                document.body.appendChild(el)
            } else {
                const listingsEl = el.querySelector('.kotn-helper-sidebar-listings')

                listingsEl.innerHTML = html
            }

            return el
        },

        renderPriceIcon: (parentEl, iconHtml, bodyHtml) => {
            return commonFns.createDetailsEl(parentEl, 'kotn-helper-icon kotn-helper-price-icon', iconHtml, `<hr />${bodyHtml}`)
        },

        renderBidsIcon: (parentEl, iconHtml, bodyHtml) => {
            return commonFns.createDetailsEl(parentEl, 'kotn-helper-icon kotn-helper-bids-icon', iconHtml, `<hr />${bodyHtml}`)
        },

        renderNotesIcon: (parentEl, iconHtml, bodyHtml) => {
            return commonFns.createDetailsEl(parentEl, 'kotn-helper-icon kotn-helper-notes-icon', iconHtml, `<hr />${bodyHtml}`)
        },

        renderOthersBiddingIcon: (parentEl, iconClass, iconHtml, bodyHtml) => {
            return commonFns.createDetailsEl(parentEl, `kotn-helper-icon kotn-helper-others-bidding ${iconClass}`, iconHtml, `<hr />${bodyHtml}`)
        },

        enableComms: async (args) => {
            setInterval(() => chrome.runtime.sendMessage({ action: 'KEEPALIVE' }), 15000)

            commonFns.injectScript('scripts/common/comms.js')

            console.log('KotN Helper - Comms enabled via this tab')
        },

        scrapeListing: async ({ html, listingId }) => {
            const parser = new DOMParser()
            const dom = parser.parseFromString(html, 'text/html')

            return {
                name: dom.querySelector('.listing-content .header h1').innerText,
                image: dom.querySelector('.listing-content .carousel-inner img').src,
                notes: dom.querySelector('.listing-content .condition > *:last-child > *:last-child').innerText.replaceAll("\n", '<br />'),
            }
        },

        scrapeListings: async ({ html, listingIds }) => {
            const parser = new DOMParser()
            const dom = parser.parseFromString(html, 'text/html')

            return Object.fromEntries(listingIds.map((listingId) => {
                const listingEl = dom.querySelector(`.listings-grid *[data-id="${listingId}"]`)
                const nameEl = listingEl.querySelector(`.listing-tile-title-link`)
                const imageEl = listingEl.querySelector(`.listing-tile-middle img`)

                return [
                    listingId,
                    {
                        name: nameEl.innerText.trim(),
                        image: imageEl.src,
                    },
                ]
            }))
        },
    }

    // extension message handlers
    const messageHandlers = {
        ENABLE_COMMS: async (args) => {
            return commonFns.enableComms(args)
        },

        SCRAPE_LISTING: async (args) => {
            return commonFns.scrapeListing(args)
        },

        SCRAPE_LISTINGS: async (args) => {
            return commonFns.scrapeListings(args)
        },

        LISTING_DETAILS: async ({ listingId, bid_increment, bids, notes }) => {
            // ignore data that isn't relevant (happens if service worker is still fetching data after tab changes pages)
            if (commonData.listingIds.includes(listingId) == false) {
                return
            }

            // keep track of processed listings
            if (commonData.listingIdsProcessed.includes(listingId.toString()) == false) {
                commonData.listingIdsProcessed.push(listingId.toString())

                // update progress toast
                commonFns.showProcessing(`Looked up ${commonData.listingIdsProcessed.length} of ${commonData.listingIds.length} listings`)
            }

            // listingFns are defined in the other content scripts
            const parentEl = listingFns.listingIconParentEl(listingId)

            // current bid totals
            const currentBid = Big(bids[0]?.bid || 0).toFixed(2)
            const currentBidFee = Big(currentBid).times(0.1).toFixed(2)
            const currentBidPlusFee = Big(currentBid).plus(currentBidFee).toFixed(2)
            const currentBidPlusFeeTax = Big(currentBidPlusFee).times(0.13).toFixed(2)
            const currentBidPlusFeePlusTax = Big(currentBidPlusFee).plus(currentBidPlusFeeTax).toFixed(2)

            // next bid totals
            const nextBid = Big(currentBid).plus(bid_increment).toFixed(2)
            const nextBidFee = Big(nextBid).times(0.1).toFixed(2)
            const nextBidPlusFee = Big(nextBid).plus(nextBidFee).toFixed(2)
            const nextBidPlusFeeTax = Big(nextBidPlusFee).times(0.13).toFixed(2)
            const nextBidPlusFeePlusTax = Big(nextBidPlusFee).plus(nextBidPlusFeeTax).toFixed(2)

            // price icon
            commonFns.renderPriceIcon(parentEl,
                `$${currentBidPlusFeePlusTax}`,
                `<table>
                    <tr>
                        <td>Current Bid:</td>
                        <td class="kotn-helper-currency">$${currentBid}</td>
                    </tr>
                    <tr>
                        <td>Buyer's premium (10%):</td>
                        <td class="kotn-helper-currency">$${currentBidFee}</td>
                    </tr>
                    <tr>
                        <td>HST (13%):</td>
                        <td class="kotn-helper-currency">$${currentBidPlusFeeTax}</td>
                    </tr>
                    <tr>
                        <td>Total:</td>
                        <td class="kotn-helper-currency">$${currentBidPlusFeePlusTax}</td>
                    </tr>
                    <tr>
                        <td colspan=2>&nbsp;</td>
                    </tr>
                    <tr>
                        <td>Next Bid:</td>
                        <td class="kotn-helper-currency">$${nextBid}</td>
                    </tr>
                    <tr>
                        <td>Buyer's premium (10%):</td>
                        <td class="kotn-helper-currency">$${nextBidFee}</td>
                    </tr>
                    <tr>
                        <td>HST (13%):</td>
                        <td class="kotn-helper-currency">$${nextBidPlusFeeTax}</td>
                    </tr>
                    <tr>
                        <td>Total:</td>
                        <td class="kotn-helper-currency">$${nextBidPlusFeePlusTax}</td>
                    </tr>
                </table>`
            )

            // bids icon
            commonFns.renderBidsIcon(
                parentEl,
                `${bids.length} bids`,
                `<table>${bids.map((bid) => `<tr><td>${bid.bidder}</td><td class="kotn-helper-currency">$${bid.bid}</td></tr>`).join('')}</table>`
            )

            // condition notes icon
            const hasSpecialCondition = listingFns.hasSpecialCondition(listingId)

            if (hasSpecialCondition) {
                commonFns.renderNotesIcon(parentEl, 'Notes', notes)
            }

            // friends bidding icon
            const friendsBids = (bids || []).filter((bid) => commonData.friends.includes(bid.bidder))

            if (friendsBids.length) {
                const friendsNames = [...new Set(friendsBids.map((bid) => bid.bidder))]

                commonFns.renderOthersBiddingIcon(
                    parentEl,
                    'friend',
                    `${friendsNames.length > 1 ? `${friendsNames.lengthFriends} Friends` : 'Friend'} ${friendsBids[0].bid == bids[0].bid ? 'Winning 🌟' : 'Bidding'}`,
                    `<table>${friendsBids.map((bid) => `<tr><td>${bid.bidder}</td><td class="kotn-helper-currency">$${bid.bid}</td></tr>`).join('')}</table>`
                )
            }

            // spouses bidding icon
            const spousesBids = (bids || []).filter((bid) => commonData.spouses.includes(bid.bidder))

            if (spousesBids.length) {
                const spousesNames = [...new Set(spousesBids.map((bid) => bid.bidder))]

                commonFns.renderOthersBiddingIcon(
                    parentEl,
                    'spouse',
                    `${spousesNames.length > 1 ? `${spousesNames.length} Spouses` : 'Spouse'} ${spousesBids[0].bid == bids[0].bid ? 'Winning 🌟' : 'Bidding'}`,
                    `<table>${spousesBids.map((bid) => `<tr><td>${bid.bidder}</td><td class="kotn-helper-currency">$${bid.bid}</td></tr>`).join('')}</table>`
                )
            }
        },

        WATCHED_LISTINGS: async ({ listings }) => {
            const listingEls = Object.entries(listings)
                .sort(([listingIdA, listingA], [listingIdB, listingB]) => {
                    const nameA = listingA.name.toUpperCase()
                    const nameB = listingB.name.toUpperCase()

                    if (nameA < nameB) {
                        return -1
                    }

                    if (nameA > nameB) {
                        return 1
                    }

                    return 0
                })
                .sort(([listingIdA, listingA], [listingIdB, listingB]) => {
                    if (listingA.sortkey > listingB.sortkey) {
                        return 1
                    }

                    if (listingA.sortkey < listingB.sortkey) {
                        return -1
                    }

                    return 0
                })
                .map(([listingId, listing]) => {
                    const hasBid = listing.watch_state == 'bid'
                    const isWinning = commonData.username == listing.bids[0]?.bidder
                    const nextBid = (listing.bids[0]?.bid || 0) + listing.bid_increment
                    const colorClassName = isWinning ? 'kotn-helper-winning' : hasBid ? 'kotn-helper-outbid' : ''

                    return `
                        <tr class="${colorClassName}">
                            <td>
                                <img src="${listing.image}" />
                            </td>
                            <td>
                                <a href="/listings/${listing.id}">${listing.name}</a>
                            </td>
                            <td class="kotn-helper-nowrap">
                                ${listing.date}
                            </td>
                            <td class="kotn-helper-nowrap">
                                ${listing.bids.length} bids
                            </td>
                            <td class="kotn-helper-nowrap kotn-helper-currency">
                                $${listing.bids[0]?.bid}
                            </td>
                            <td class="kotn-helper-nowrap kotn-helper-currency">
                                ${!isWinning ? `
                                    <a href="javascript:kotnHelperFns.bid(${listingId}, ${nextBid})">Bid $${nextBid}</a><br />
                                    <a href="javascript:kotnHelperFns.unwatch(${listingId})">Unwatch</a><br />
                                ` : ''}
                            </td>
                        </tr>
                    `
                })
                .join('')

            commonFns.renderSidebarEl(`<table>${listingEls}</table>`)
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

        return true // needed to return asynchronously
    })

    // inject.js postMessage handlers
    const postMessageHandlers = {
        COMMON_SCRIPT_INJECTED: () => {
            chrome.runtime.sendMessage({ action: 'COMMON_SCRIPT_INJECTED' })
        },

        REQUEST_LISTING_DETAILS: async ({ listingIds }) => {
            commonData.listingIds = listingIds

            commonFns.showProcessing(`Looking up ${listingIds.length} listings`)

            await chrome.runtime.sendMessage({ action: 'REQUEST_LISTING_DETAILS', args: { listingIds } })

            commonFns.hideProcessing()
        },
    }

    // listen for postMessages from scripts/common/inject.js
    window.addEventListener('message', (event) => {
        if (event.data.to != 'COMMON_CONTENT_SCRIPT') {
            return
        }

        // handle the message here if there's a function for it, otherwise send it to the service worker
        if (event.data.message.action in postMessageHandlers) {
            postMessageHandlers[event.data.message.action](event.data.message.args)
        } else {
            chrome.runtime.sendMessage(event.data.message)
        }
    })

    // cache friend names and username
    const storedData = await chrome.storage.sync.get(['options.friends.names', 'options.spouses.names', 'options.user.username'])
    commonData.friends = (storedData['options.friends.names'] || '').trim().split("\n")
    commonData.spouses = (storedData['options.spouses.names'] || '').trim().split("\n")
    commonData.username = storedData['options.user.username']


    // inject styles
    commonFns.injectStyles('scripts/common/inject.css')

    // inject script
    commonFns.injectScript('scripts/common/inject.js')

    // tell the service worker that this tab is ready
    chrome.runtime.sendMessage({ action: 'COMMON_OPENED' })
}())
