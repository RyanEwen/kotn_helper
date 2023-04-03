console.log('KotN Helper - Service Worker')

import moment from '/lib/moment.js';

const data = {
    urls: {
        base: 'https://kotnauction.com',
        auctions: 'https://kotnauction.com/auctions',
        listings: 'https://kotnauction.com/listings',
        watchedListings: 'https://kotnauction.com/listings/watched',
    },
    watchedListingsTabIds: [],
    userId: null,
    username: null,
    watchedListings: {},
}

// basic extension utility functions
const utilities = {
    updateBadge: (text, color) => {
        chrome.action.setBadgeText({ text })

        if (color) {
            chrome.action.setBadgeBackgroundColor({ color })
        }
    },

    focusOrOpenTab: async (urlMatch, url) => {
        const tabs = await chrome.tabs.query({ url: urlMatch })

        if (tabs.length) {
            // focus existing tab and window
            chrome.tabs.update(tabs[0].id, { active: true })
            chrome.windows.update(tabs[0].windowId, { focused: true })
        } else {
            // open a new tab and focus window
            chrome.tabs.create({ url })
        }
    },

    reloadTabs: async (urlMatch) => {
        const tabs = await chrome.tabs.query({ url: urlMatch })

        tabs.forEach((tab) => {
            chrome.tabs.reload(tabs.id)
        })
    },

    readCookie: async (name) => {
        const cookie = await chrome.cookies.get({ name, url: data.urls.base })

        return decodeURIComponent(cookie.value)
    },

    playSound: async (sound) => {
        await utilities.setupOffscreenDoc()

        await chrome.runtime.sendMessage({
            action: 'PLAY_SOUND',
            args: sound,
        })
    },

    setupOffscreenDoc: async () => {
        const path = 'offscreen.html'
        const offscreenUrl = chrome.runtime.getURL(path)
        const matchedClients = await clients.matchAll()

        // don't do anything if there's already an offscreen doc
        for (const client of matchedClients) {
            if (client.url === offscreenUrl) {
                return
            }
        }

        // create the offscreen doc
        await chrome.offscreen.createDocument({
            url: chrome.runtime.getURL(path),
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Play a sound',
        })
    },

    createBrowserNotification: (id, title, message, buttons = undefined) => {
        return chrome.notifications.create(id, {
            type: 'basic',
            title,
            message,
            buttons,
            iconUrl: 'images/icon-48.jpeg',
            // requireInteraction: true,
        })
    },
}

// kotn tab functions
const listings = {
    openWatchedListingsTab: () => {
        utilities.focusOrOpenTab(`${data.urls.watchedListings}*`, data.urls.watchedListings)
    },

    reloadWatchedListingsTabs: () => {
        utilities.reloadTabs(`${data.urls.watchedListings}*`)
    },

    openListingTab: (id) => {
        utilities.focusOrOpenTab(`${data.urls.listings}/${id}*`, `${data.urls.listings}/${id}`)
    },

    checkIfFriendsBidding: async (listing, tabId) => {
        const storageKeys = ['options.friends.names', 'options.spouses.names']
        const storedData = await chrome.storage.sync.get(storageKeys)
        const friendsSetting = storedData[storageKeys[0]] || ''
        const spousesSetting = storedData[storageKeys[1]] || ''
        const friends = friendsSetting.split("\n")
        const spouses = spousesSetting.split("\n")

        const friendsBids = (listing.bids || [])
            .filter((bid) => friends.includes(bid.bidder))

        const spousesBids = (listing.bids || [])
            .filter((bid) => spouses.includes(bid.bidder))

        // only send to specific tab if requested by a specific tab
        const tabIds = tabId ? [tabId] : data.watchedListingsTabIds

        if (friendsBids.length) {
            tabIds.forEach((tabId) => {
                chrome.tabs.sendMessage(tabId, {
                    action: 'HIGHLIGHT_FRIEND_LISTING',
                    args: {
                        listingId: listing.id,
                        friendsBids,
                    },
                })
            })
        }

        if (spousesBids.length) {
            tabIds.forEach((tabId) => {
                chrome.tabs.sendMessage(tabId, {
                    action: 'HIGHLIGHT_SPOUSE_LISTING',
                    args: {
                        listingId: listing.id,
                        spousesBids,
                    },
                })
            })
        }
    }
}

// kotn notification functions
const notifications = {
    endingSoonButWinning: (mediums, listingId, currentBid) => {
        const listingName = listingId == 'TEST' ? 'TEST ITEM ' : (data.watchedListings[listingId].name || '')
        const title = "Listing ending soon!"
        const message = `$${currentBid} (you) - ${listingName}`

        if (mediums.sound) {
            utilities.playSound('beeps')
        }

        if (mediums.notification) {
            utilities.createBrowserNotification(`ENDING_WINNING.${listingId}`, title, message, [
                { title: 'View Listing' },
            ])
        }

        if (mediums.webhooks) {
            webhooks.call({
                event: 'listing_ending_soon_winning',
                title,
                message,
                listingUrl: `${data.urls.listings}/${listingId}`,
                listingName,
                currentBid,
            })
        }
    },

    endingSoonAndLosing: (mediums, listingId, currentBid, nextBid) => {
        const listingName = listingId == 'TEST' ? 'TEST ITEM ' : (data.watchedListings[listingId].name || '')
        const title = "Listing ending soon!"
        const message = `$${currentBid} - ${listingName}`

        if (mediums.sound) {
            utilities.playSound('beeps')
        }

        if (mediums.notification) {
            utilities.createBrowserNotification(`ENDING_LOSING.${listingId}.${nextBid}`, title, message, [
                { title: 'Unwatch' },
                { title: `Bid $${nextBid}` },
            ])
        }

        if (mediums.webhooks) {
            webhooks.call({
                event: 'listing_ending_soon_losing',
                title,
                message,
                listingUrl: `${data.urls.listings}/${listingId}`,
                listingName,
                currentBid,
                nextBid,
            })
        }
    },

    outbid: (mediums, listingId, previousBid, currentBid, nextBid) => {
        const listingName = listingId == 'TEST' ? 'TEST ITEM ' : (data.watchedListings[listingId].name || '')
        const title = "You've been outbid!"
        const message = `$${currentBid} - ${listingName}`

        if (mediums.sound) {
            utilities.playSound('beeps')
        }

        if (mediums.notification) {
            utilities.createBrowserNotification(`OUTBID.${listingId}.${nextBid}`, title, message, [
                { title: 'Unwatch' },
                { title: `Bid $${nextBid}` },
            ])
        }

        if (mediums.webhooks) {
            webhooks.call({
                event: 'outbid',
                title,
                message,
                listingUrl: `${data.urls.listings}/${listingId}`,
                listingName,
                previousBid,
                currentBid,
                nextBid,
            })
        }
    },

    itemWon: (mediums, listingId) => {
        const listingName = listingId == 'TEST' ? 'TEST ITEM ' : (data.watchedListings[listingId].name || '')
        const title = 'Item won!'
        const message = listingName

        if (mediums.sound) {
            utilities.playSound('yay')
        }

        if (mediums.notification) {
            utilities.createBrowserNotification(`ITEM_WON.${listingId}`, title, message, [
                { title: 'View listing' },
            ])
        }

        if (mediums.webhooks) {
            webhooks.call({
                event: 'item_won',
                title,
                message,
                listingUrl: `${data.urls.listings}/${listingId}`,
                listingName,
            })
        }
    },
}

// kotn apis
const apis = {
    call: async (url, method = 'GET', data, asJson = true) => {
        const headers = {
            'X-XSRF-TOKEN': await utilities.readCookie('XSRF-TOKEN'),
            'Accept': 'application/json, text/plain, */*',
        }

        if (data) {
            headers['Content-Type'] = 'application/json'
        }

        const body = data ? JSON.stringify(data) : undefined

        const request = await fetch(url, { headers, body, method })

        if (asJson) {
            return request.json()
        } else {
            return request.text()
        }
    },

    scrapeLine: async (url, searchText) => {
        const page = await apis.call(url, 'GET', undefined, false)

        return page
            ?.split("\n")
            ?.find((line) => line.includes(searchText))
            ?.trim()
    },

    bid: (listingId, bid) => apis.call(`${data.urls.base}/listings/${listingId}/bid`, 'POST', { bid }),

    watch: (listingId) => apis.call(`${data.urls.base}/listings/${listingId}/watch`, 'POST'),

    ignore: (listingId) => apis.call(`${data.urls.base}/listings/${listingId}/ignore`, 'POST'),

    refresh: (listingIds) => apis.call(`${data.urls.base}/listings/refresh`, 'POST', { ids: listingIds }),

    getBids: async (listingId) => {
        const searchText = 'var initialBids = '
        const line = await apis.scrapeLine(`${data.urls.base}/listings/${listingId}`, searchText)
        const value = line.substr(0, line.length - 1).replace(searchText, '')

        return JSON.parse(value)
    },
}

// webhook functions
const webhooks = {
    call: async (data) => {
        const storageKey = 'options.webhooks.urls'
        const storedData = await chrome.storage.sync.get(storageKey)
        const urls = (storedData[storageKey] || '').split("\n")

        urls.forEach((url) => {
            const headers = {
                'Content-Type': 'application/json'
            }

            const body = data ? JSON.stringify(data) : undefined

            fetch(url, { headers, body, method: 'POST' })
        })
    },
}

// extension message handlers
const messageHandlers = {
    SHOW_WATCHED_LISTINGS: (args, sender) => {
        listings.openWatchedListingsTab()
    },

    TEST_ENDING_WINNING_NOTIFICATION: (args, sender) => {
        notifications.endingSoonButWinning({ sound: true, webhooks: true, notification: true}, 'TEST', 5)
    },

    TEST_ENDING_LOSING_NOTIFICATION: (args, sender) => {
        notifications.endingSoonAndLosing({ sound: true, webhooks: true, notification: true}, 'TEST', 5, 10)
    },

    TEST_OUTBID_NOTIFICATION: (args, sender) => {
        notifications.outbid({ sound: true, webhooks: true, notification: true}, 'TEST', 5, 10, 15)
    },

    TEST_ITEM_WON_NOTIFICATION: (args, sender) => {
        notifications.itemWon({ sound: true, webhooks: true, notification: true}, 'TEST')
    },

    AUCTIONS_LOADED: async (args, sender) => {
        // check if friends are bidding on items (limit to one request at a time)
        setTimeout(async () => {
            const queue = {
                todo: Object.keys(args.listings),
                processing: [],
                completed: [],
            }

            function processNextBatch() {
                if (queue.processing.length < 10) {
                    const idsToProcess = queue.todo.slice(0, 5 - queue.processing.length)

                    idsToProcess.forEach(async (listingIdToProcess) => {
                        // move id from waiting to inProgress
                        queue.todo = queue.todo.filter((listingId) => listingId != listingIdToProcess)
                        queue.processing.push(listingIdToProcess)

                        // check the listing
                        const listing = args.listings[listingIdToProcess]
                        listing.bids = await apis.getBids(listingIdToProcess)
                        listings.checkIfFriendsBidding(listing, sender.tab.id)

                        // move id from inProgress to complete
                        queue.processing = queue.processing.filter((listingId) => listingId != listingIdToProcess)
                        queue.completed.push(listingIdToProcess)

                        processNextBatch()
                    })
                }
            }

            processNextBatch()

            // for (const listingId in args.listings) {
            //     const listing = args.listings[listingId]

            //     listing.bids = await apis.getBids(listingId)

            //     listings.checkIfFriendsBidding(listing, sender.tab.id)
            // }
        })
    },

    LISTING_LOADED: async (args, sender) => {
        // check if friends are bidding on item
        listings.checkIfFriendsBidding(args.listing, sender.tab.id)
    },

    WATCHED_LISTINGS_OPENED: async (args, sender) => {
        // check if the tab has already been opened (meaning this is a refresh)
        if (data.watchedListingsTabIds.includes(sender.tab.id)) {
            // if tab was being used for comms before being refresh re-enable comms
            if (data.watchedListingsTabIds[0] == sender.tab.id) {
                console.log(`Enabling comms via tab ${sender.tab.id} again due to refresh`)
                chrome.tabs.sendMessage(sender.tab.id, { action: 'ENABLE_COMMS' })
            }
        // new tab opened
        } else {
            // add the tab id to the list
            data.watchedListingsTabIds.push(sender.tab.id)

            // if this is the first/only tab, then use it for comms
            if (data.watchedListingsTabIds.length == 1) {
                console.log(`Enabling comms via tab ${sender.tab.id}`)
                chrome.tabs.sendMessage(sender.tab.id, { action: 'ENABLE_COMMS' })
            }
        }

        // let the new tab know about friend bids
        Object.entries(data.watchedListings).forEach(([listingId, listing]) => {
            listings.checkIfFriendsBidding(listing, sender.tab.id)
        })
    },

    WATCHED_LISTINGS_CONNECTED: async (args, sender) => {
        utilities.updateBadge('ON', 'green')

        // clear old listing ending timeouts
        Object.entries(data.watchedListings).forEach(([listingId, listing]) => {
            clearTimeout(listing.timeout)
        })

        data.userId = args.userId
        data.username = args.username
        data.watchedListings = args.watchedListings

        // check if friends are bidding on watched items (limit to one request at a time)
        setTimeout(async () => {
            const queue = {
                todo: Object.keys(data.watchedListings),
                processing: [],
                completed: [],
            }

            function processNextBatch() {
                if (queue.processing.length < 10) {
                    const idsToProcess = queue.todo.slice(0, 5 - queue.processing.length)

                    idsToProcess.forEach(async (listingIdToProcess) => {
                        // move id from waiting to inProgress
                        queue.todo = queue.todo.filter((listingId) => listingId != listingIdToProcess)
                        queue.processing.push(listingIdToProcess)

                        // check the listing
                        const listing = data.watchedListings[listingIdToProcess]
                        listing.bids = await apis.getBids(listingIdToProcess)
                        listings.checkIfFriendsBidding(listing)

                        // move id from inProgress to complete
                        queue.processing = queue.processing.filter((listingId) => listingId != listingIdToProcess)
                        queue.completed.push(listingIdToProcess)

                        processNextBatch()
                    })
                }
            }

            processNextBatch()

            // for (const listingId in data.watchedListings) {
            //     const listing = data.watchedListings[listingId]

            //     listing.bids = await apis.getBids(listingId)

            //     listings.checkIfFriendsBidding(listing)
            // }
        })

        // create new listing ending timeouts
        Object.entries(data.watchedListings).forEach(([listingId, listing]) => {
            const endTime = moment(listing.end)
            const twoMinsFromEndTime = moment(endTime).subtract(2, 'minutes')

            // don't create a timeout if listing is already ending
            if (moment().isBetween(twoMinsFromEndTime, endTime)) {
                return
            }

            // get 2m5s before endTime in ms
            const milisecondsFromNow = moment(twoMinsFromEndTime).subtract(5, 'seconds').diff()

            // run notify code 2m5s before endTime
            listing.timeout = setTimeout(async () => {
                const detail = await apis.refresh([listingId])

                // don't go any further if the listing isn't watched or bid on
                if (!detail[listingId].watch || detail[listingId].watch == 'ignore') {
                    return
                }

                const notificationActions = {
                    'disabled': async () => {
                        return
                    },
                    'always': async () => {
                        if (detail[listingId].bidder == data.username) {
                            notifications.endingSoonButWinning({ sound: true, notification: true}, listingId, detail[listingId].bid)
                        } else {
                            notifications.endingSoonAndLosing({ sound: true, notification: true}, listingId, detail[listingId].bid, detail[listingId].bid + detail[listingId].bid_increment)
                        }
                    },
                    'unlessWinning': async () => {
                        if (detail[listingId].bidder == data.username) {
                            return
                        }

                        notifications.endingSoonAndLosing({ sound: true, notification: true}, listingId, detail[listingId].bid, detail[listingId].bid + detail[listingId].bid_increment)
                    },
                }

                const webhooksActions = {
                    'disabled': async () => {
                        return
                    },
                    'always': async () => {
                        if (detail[listingId].bidder == data.username) {
                            notifications.endingSoonButWinning({ webhooks: true }, listingId, detail[listingId].bid)
                        } else {
                            notifications.endingSoonAndLosing({ webhooks: true }, listingId, detail[listingId].bid, detail[listingId].bid + detail[listingId].bid_increment)
                        }
                    },
                    'unlessWinning': async () => {
                        if (detail[listingId].bidder == data.username) {
                            return
                        }

                        notifications.endingSoonAndLosing({ webhooks: true }, listingId, detail[listingId].bid, detail[listingId].bid + detail[listingId].bid_increment)
                    },
                }

                const storageKeys = ['options.notifications.ending', 'options.webhooks.ending']
                const storedData = await chrome.storage.sync.get(storageKeys)
                const notificationSetting = storedData[storageKeys[0]] || 'unlessWinning'
                const webhooksSetting = storedData[storageKeys[1]] || 'unlessWinning'

                // execute the notification action based on the setting
                if (notificationSetting in notificationActions) {
                    notificationActions[notificationSetting]()
                }

                // execute the webhooks action based on the setting
                if (webhooksSetting in webhooksActions) {
                    webhooksActions[webhooksSetting]()
                }
            }, milisecondsFromNow)
        })
    },

    BID_PLACED: async (args, sender) => {
        // eg: { "id": 13841801, "listing_id": 974702, "bid": 3, "bidder": "yourguymike", "created_at": "2023-03-21 12:30:59", "listing_end": "2023-03-26 16:00:00" }

        // if bid is on a watched listing
        if (args.listing_id in data.watchedListings) {
            // only check for friends bids if we already have the bid list
            if ('bids' in data.watchedListings[args.listing_id]) {
                data.watchedListings[args.listing_id].bids.push({
                    id: args.id,
                    bid: args.bid,
                    bidder: args.bidder,
                    created_at: args.created_at,
                })

                listings.checkIfFriendsBidding(data.watchedListings[args.listing_id])
            }
        }

        // TODO send to auction pages as well
    },

    WATCH_STATE_CHANGED: async (args, sender) => {
        // eg: { "listing_id": 974742, "state": "ignore" }
        // known states: "bid", "watch", "ignore", null

        // refresh watched listings page if the item isn't on it
        if (args.listing_id in data.watchedListings == false) {
            listings.reloadWatchedListingsTabs()
        }
    },

    OUTBID: async (args, sender) => {
        // eg: { "user_id": 17965, "listing_id": 974702, "previous_bid": 2, "current_bid": 3 }

        const notifcationActions = {
            'disabled': async () => {
                return
            },
            'always': async () => {
                const detail = await apis.refresh([args.listing_id])

                notifications.outbid({ sound: true, notification: true}, args.listing_id, args.previous_bid, args.current_bid, detail[args.listing_id].bid + detail[args.listing_id].bid_increment)
            },
            'last2minutes': async () => {
                const detail = await apis.refresh([args.listing_id])
                const endTime = moment(detail[args.listing_id].end)
                const twoMinsFromEndTime = moment(endTime).subtract(2, 'minutes')

                // check if auction is ending
                if (moment().isBetween(twoMinsFromEndTime, endTime)) {
                    notifications.outbid({ sound: true, notification: true}, args.listing_id, args.previous_bid, args.current_bid, detail[args.listing_id].bid + detail[args.listing_id].bid_increment)
                }
            },
        }

        const webhooksActions = {
            'disabled': async () => {
                return
            },
            'always': async () => {
                const detail = await apis.refresh([args.listing_id])

                notifications.outbid({ webhooks: true }, args.listing_id, args.previous_bid, args.current_bid, detail[args.listing_id].bid + detail[args.listing_id].bid_increment)
            },
            'last2minutes': async () => {
                const detail = await apis.refresh([args.listing_id])
                const endTime = moment(detail[args.listing_id].end)
                const twoMinsFromEndTime = moment(endTime).subtract(2, 'minutes')

                // check if auction is ending
                if (moment().isBetween(twoMinsFromEndTime, endTime)) {
                    notifications.outbid({ webhooks: true }, args.listing_id, args.previous_bid, args.current_bid, detail[args.listing_id].bid + detail[args.listing_id].bid_increment)
                }
            },
        }

        const storageKeys = ['options.notifications.outbid', 'options.webhooks.outbid']
        const storedData = await chrome.storage.sync.get(storageKeys)
        const notificationSetting = storedData[storageKeys[0]] || 'last2minutes'
        const webhooksSetting = storedData[storageKeys[1]] || 'last2minutes'

        // execute the notification action based on the setting
        if (notificationSetting in notifcationActions) {
            notifcationActions[notificationSetting]()
        }

        // execute the webhooks action based on the setting
        if (webhooksSetting in webhooksActions) {
            webhooksActions[webhooksSetting]()
        }
    },

    ITEM_WON: async (args, sender) => {
        const notificationActions = {
            'disabled': async () => {
                return
            },
            'always': async () => {
                notifications.itemWon({ sound: true, notification: true}, args.listing_id)
            },
        }

        const webhooksActions = {
            'disabled': async () => {
                return
            },
            'always': async () => {
                notifications.itemWon({ webhooks: true }, args.listing_id)
            },
        }

        const storageKeys = ['options.notifications.itemWon', 'options.webhooks.itemWon']
        const storedData = await chrome.storage.sync.get(storageKeys)
        const notificationSetting = storedData[storageKeys[0]] || 'always'
        const webhooksSetting = storedData[storageKeys[1]] || 'always'

        // execute the notification action based on the setting
        if (notificationSetting in notificationActions) {
            notificationActions[notificationSetting]()
        }

        // execute the webhooks action based on the setting
        if (webhooksSetting in webhooksActions) {
            webhooksActions[webhooksSetting]()
        }
    },
}

// browser notification handlers
const browserNotificationHandlers = {
    INSTALLED: () => {
        listings.openWatchedListingsTab()
    },

    ENDING_WINNING: (buttonIndex, [ listingId ]) => {
        switch (buttonIndex) {
            // no button
            case -1:
            // view button
            case 0:
                // tabs.openListing(listingId)
                listings.openWatchedListingsTab()
            break
        }
    },

    ENDING_LOSING: (buttonIndex, [ listingId, nextBid ]) => {
        switch (buttonIndex) {
            // no button
            case -1:
                // tabs.openListing(listingId)
                listings.openWatchedListingsTab()
            break

            // unwatch button
            case 0:
                if (listingId == 'TEST') {
                    break
                }

                apis.ignore(listingId)
            break

            // bid button
            case 1:
                if (listingId == 'TEST') {
                    break
                }

                apis.bid(listingId, nextBid)
            break
        }
    },

    OUTBID: (buttonIndex, [ listingId, nextBid ]) => {
        switch (buttonIndex) {
            // no button
            case -1:
                // tabs.openListing(listingId)
                listings.openWatchedListingsTab()
            break

            // unwatch button
            case 0:
                if (listingId == 'TEST') {
                    break
                }

                apis.ignore(listingId)
            break

            // bid button
            case 1:
                if (listingId == 'TEST') {
                    break
                }

                apis.bid(listingId, nextBid)
            break
        }
    },

    ITEM_WON: (buttonIndex, [ listingId ]) => {
        switch (buttonIndex) {
            // no button
            case -1:
                // pass
            break

            // view button
            case 0:
                listings.openListingTab(listingId)
            break
        }
    }
}

// listen for extension installation
chrome.runtime.onInstalled.addListener(async ({ reason, version }) => {
    if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
        utilities.playSound('yay')

        utilities.createBrowserNotification('INSTALLED', `Extension installed`, 'Yay!')
    }
})

// listen for extension messages
chrome.runtime.onMessage.addListener((message, sender) => {
    console.log(message, sender?.tab?.id)

    if (message.action in messageHandlers) {
        messageHandlers[message.action](message.args, sender)
    }
})

// listen for browser notification clicks
chrome.notifications.onClicked.addListener((id) => {
    const [ type, ...details ] = id.split('.')

    if (type in browserNotificationHandlers) {
        browserNotificationHandlers[type](-1, details)
    }
})

// listen for browser notification button clicks
chrome.notifications.onButtonClicked.addListener((id, index) => {
    const [ type, ...details ] = id.split('.')

    if (type in browserNotificationHandlers) {
        browserNotificationHandlers[type](index, details)
    }
})

// listen for browser navigations
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // try to enforce per-page setting
    const url = new URL(details.url)
    const storageKey = 'options.tweaks.itemsPerPage'
    const storedData = await chrome.storage.sync.get(storageKey)
    const perPageSetting = storedData[storageKey] || 'default'

    // don't adjust if no preference or if user has chosen another option on the page
    if (perPageSetting == 'default' || url.searchParams.has('per_page')) {
        return
    }

    url.searchParams.set('per_page', perPageSetting)

    await chrome.tabs.update(details.tabId, {
        url: url.href,
    })
}, {
    url: [
        { urlMatches: `${data.urls.auctions}*` },
        { urlMatches: `${data.urls.watchedListings}*` },
    ],
})

// listen for tab updates
chrome.tabs.onUpdated.addListener(async ( updatedTabId, changeInfo, tab ) => {
    const commsTabId = data.watchedListingsTabIds[0]

    // if a watched listings tab has navigated elsewhere
    if (data.watchedListingsTabIds.includes(updatedTabId) && 'url' in changeInfo && changeInfo.url.includes(data.urls.watchedListings) == false) {
        // remove the tab id from the list
        data.watchedListingsTabIds = data.watchedListingsTabIds.filter((tabId) => tabId != updatedTabId)

        // if the tab used for comms is no longer open
        if (data.watchedListingsTabIds.includes(commsTabId) == false) {
            // clear timeouts
            Object.entries(data.watchedListings).forEach(([listingId, listing]) => {
                clearTimeout(listing.timeout)
            })

            // if there are other tabs that can be used for comms
            if (data.watchedListingsTabIds.length) {
                // use the first one in the list
                console.log(`Enabling comms via tab ${data.watchedListingsTabIds[0]} due to tab ${commsTabId} navigating away`)
                chrome.tabs.sendMessage(data.watchedListingsTabIds[0], { action: 'ENABLE_COMMS' })
            } else {
                utilities.updateBadge('')
                console.log('No tabs available for comms.')
            }
        }
    }
})

// listen for tab closings
chrome.tabs.onRemoved.addListener(( removedTabId ) => {
    const commsTabId = data.watchedListingsTabIds[0]

    // remove the closed tab id from the list
    data.watchedListingsTabIds = data.watchedListingsTabIds.filter((tabId) => tabId != removedTabId)

    // if the tab used for comms is no longer open
    if (data.watchedListingsTabIds.includes(commsTabId) == false) {
        // clear timeouts
        Object.entries(data.watchedListings).forEach(([listingId, listing]) => {
            clearTimeout(listing.timeout)
        })

        // if there are other tabs that can be used for comms
        if (data.watchedListingsTabIds.length) {
            // use the first one in the list
            console.log(`Enabling comms via tab ${data.watchedListingsTabIds[0]} due to tab ${commsTabId} closing`)
            chrome.tabs.sendMessage(data.watchedListingsTabIds[0], { action: 'ENABLE_COMMS' })
        } else {
            utilities.updateBadge('')
            console.log('No tabs available for comms.')
        }
    }
})

// clear badge on startup
utilities.updateBadge('')
