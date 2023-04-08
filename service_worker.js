console.log('KotN Helper - Service Worker')

import moment from '/lib/moment.js';

// basic extension utility functions
const utilityFns = {
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
        await utilityFns.setupOffscreenDoc()

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

    sendMessageToTab: (tabId, message) => {
        try {
            return chrome.tabs.sendMessage(tabId, message)
        } catch (err) {
            console.log(`Tried sending message to closed tab ${tabId}`)
            return null
        }
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

    createPromise() {
        let resolve
        let reject

        const promise = new Promise((res, rej) => {
            resolve = res
            reject = rej
        })

        return { promise, reject, resolve }
    },
}

// kotn tab functions
const listingFns = {
    monitorListings: async (listings) => {
        data.watchedListings = { ...data.watchedListings, ...listings }

        const promise = utilityFns.createPromise()

        console.log(`Fetching data for ${Object.keys(listings).length} listings`)

        // get bids and names (limit to 10 requests at a time)
        const queue = {
            todo: Object.keys(listings),
            processing: [],
            completed: [],
        }

        function processNextBatch() {
            if (queue.todo.length == 0 && queue.processing.length == 0) {
                promise.resolve()
            }

            if (queue.processing.length <= 15) {
                const idsToProcess = queue.todo.slice(0, 15 - queue.processing.length)

                idsToProcess.forEach(async (listingIdToProcess) => {
                    // move id from waiting to inProgress
                    queue.todo = queue.todo.filter((listingId) => listingId != listingIdToProcess)
                    queue.processing.push(listingIdToProcess)

                    // get listing name and bids
                    const listing = listings[listingIdToProcess]

                    const { name, bids } = await apiFns.scrapeListing(listingIdToProcess)

                    listing.id = listingIdToProcess
                    listing.name = name
                    listing.bids = bids

                    const endTime = moment(listing.end)
                    const twoMinsFromEndTime = moment(endTime).subtract(2, 'minutes')

                    // create a timeout if listing is not yet ending
                    if (moment().isBetween(twoMinsFromEndTime, endTime) == false) {
                        // run notify code 2m5s before endTime
                        listing.timeout = setTimeout(async () => {
                            // get the very latest detail in case cache is stale
                            const listingDetail = (await apiFns.refresh([listingIdToProcess]))[listingIdToProcess]

                            // don't go any further if the listing isn't watched or bid on
                            if (!listingDetail.watch || listingDetail.watch == 'ignore') {
                                return
                            }

                            const notificationActions = {
                                'disabled': async () => {
                                    return
                                },
                                'always': async () => {
                                    if (listingDetail.bidder == data.username) {
                                        notificationFns.endingSoonButWinning({ sound: true, notification: true }, listingIdToProcess, listingDetail.bid)
                                    } else {
                                        notificationFns.endingSoonAndLosing({ sound: true, notification: true }, listingIdToProcess, listingDetail.bid, listingDetail.bid + listingDetail.bid_increment)
                                    }
                                },
                                'unlessWinning': async () => {
                                    if (listingDetail.bidder == data.username) {
                                        return
                                    }

                                    notificationFns.endingSoonAndLosing({ sound: true, notification: true }, listingIdToProcess, listingDetail.bid, listingDetail.bid + listingDetail.bid_increment)
                                },
                            }

                            const webhooksActions = {
                                'disabled': async () => {
                                    return
                                },
                                'always': async () => {
                                    if (listingDetail.bidder == data.username) {
                                        notificationFns.endingSoonButWinning({ webhooks: true }, listingIdToProcess, listingDetail.bid)
                                    } else {
                                        notificationFns.endingSoonAndLosing({ webhooks: true }, listingIdToProcess, listingDetail.bid, listingDetail.bid + listingDetail.bid_increment)
                                    }
                                },
                                'unlessWinning': async () => {
                                    if (listingDetail.bidder == data.username) {
                                        return
                                    }

                                    notificationFns.endingSoonAndLosing({ webhooks: true }, listingIdToProcess, listingDetail.bid, listingDetail.bid + listingDetail.bid_increment)
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
                        }, moment(twoMinsFromEndTime).subtract(5, 'seconds').diff())
                    }

                    // move id from inProgress to complete
                    queue.processing = queue.processing.filter((listingId) => listingId != listingIdToProcess)
                    queue.completed.push(listingIdToProcess)

                    processNextBatch()
                })
            }
        }

        processNextBatch()

        await promise.promise

        console.log(`Done fetching data`)
    },

    unmonitorListings: (listings) => {
        Object.keys(listings).forEach((listingId) => {
            // clear old listing ending timeouts
            clearTimeout(data.watchedListings[listingId].timeout)

            // remove the listing data
            delete data.watchedListings[listingId]
        })
    },

    openWatchedListingsTab: () => {
        utilityFns.focusOrOpenTab(`${data.urls.watchedListings}*`, data.urls.watchedListings)
    },

    reloadWatchedListingsTabs: () => {
        utilityFns.reloadTabs(`${data.urls.watchedListings}*`)
    },

    openListingTab: (id) => {
        utilityFns.focusOrOpenTab(`${data.urls.listings}/${id}*`, `${data.urls.listings}/${id}`)
    },

    checkIfFriendsBidding: async (listing, tabId) => {
        const storageKeys = ['options.friends.names', 'options.spouses.names']
        const storedData = await chrome.storage.sync.get(storageKeys)
        const friendsSetting = storedData[storageKeys[0]] || ''
        const spousesSetting = storedData[storageKeys[1]] || ''
        const friends = friendsSetting.trim().split("\n")
        const spouses = spousesSetting.trim().split("\n")

        const friendsBids = (listing.bids || [])
            .filter((bid) => friends.includes(bid.bidder))

        const spousesBids = (listing.bids || [])
            .filter((bid) => spouses.includes(bid.bidder))

        // only send to specific tab if requested by a specific tab
        const tabIds = tabId ? [tabId] : data.tabIds

        if (friendsBids.length) {
            tabIds.forEach((tabId) => {
                utilityFns.sendMessageToTab(tabId, {
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
                utilityFns.sendMessageToTab(tabId, {
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
const notificationFns = {
    endingSoonButWinning: (mediums, listingId, currentBid) => {
        const listingName = listingId == 'TEST' ? 'TEST ITEM ' : (data.watchedListings[listingId].name || '')
        const title = "Listing ending soon!"
        const message = `$${currentBid} (you) - ${listingName}`

        if (mediums.sound) {
            try {
                utilityFns.playSound('beeps')
            } catch (e) {
                console.error(e)
            }
        }

        if (mediums.notification) {
            try {
                utilityFns.createBrowserNotification(`ENDING_WINNING.${listingId}`, title, message, [
                    { title: 'View Listing' },
                ])
            } catch (e) {
                console.error(e)
            }
        }

        if (mediums.webhooks) {
            try {
                webhookFns.call({
                    event: 'listing_ending_soon_winning',
                    title,
                    message,
                    listingUrl: `${data.urls.listings}/${listingId}`,
                    listingName,
                    currentBid,
                })
            } catch (e) {
                console.error(e)
            }
        }
    },

    endingSoonAndLosing: (mediums, listingId, currentBid, nextBid) => {
        const listingName = listingId == 'TEST' ? 'TEST ITEM ' : (data.watchedListings[listingId].name || '')
        const title = "Listing ending soon!"
        const message = `$${currentBid} - ${listingName}`

        if (mediums.sound) {
            try {
                utilityFns.playSound('beeps')
            } catch (e) {
                console.error(e)
            }
        }

        if (mediums.notification) {
            try {
                utilityFns.createBrowserNotification(`ENDING_LOSING.${listingId}.${nextBid}`, title, message, [
                    { title: 'Unwatch' },
                    { title: `Bid $${nextBid}` },
                ])
            } catch (e) {
                console.error(e)
            }
        }

        if (mediums.webhooks) {
            try {
                webhookFns.call({
                    event: 'listing_ending_soon_losing',
                    title,
                    message,
                    listingUrl: `${data.urls.listings}/${listingId}`,
                    listingName,
                    currentBid,
                    nextBid,
                })
            } catch (e) {
                console.error(e)
            }
        }
    },

    outbid: (mediums, listingId, previousBid, currentBid, nextBid) => {
        const listingName = listingId == 'TEST' ? 'TEST ITEM ' : (data.watchedListings[listingId].name || '')
        const title = "You've been outbid!"
        const message = `$${currentBid} - ${listingName}`

        if (mediums.sound) {
            try {
                utilityFns.playSound('beeps')
            } catch (e) {
                console.error(e)
            }
        }

        if (mediums.notification) {
            try {
                utilityFns.createBrowserNotification(`OUTBID.${listingId}.${nextBid}`, title, message, [
                    { title: 'Unwatch' },
                    { title: `Bid $${nextBid}` },
                ])
            } catch (e) {
                console.error(e)
            }
        }

        if (mediums.webhooks) {
            try {
                webhookFns.call({
                    event: 'outbid',
                    title,
                    message,
                    listingUrl: `${data.urls.listings}/${listingId}`,
                    listingName,
                    previousBid,
                    currentBid,
                    nextBid,
                })
            } catch (e) {
                console.error(e)
            }
        }
    },

    itemWon: (mediums, listingId) => {
        const listingName = listingId == 'TEST' ? 'TEST ITEM ' : (data.watchedListings[listingId].name || '')
        const title = 'Item won!'
        const message = listingName

        if (mediums.sound) {
            try {
                utilityFns.playSound('yay')
            } catch (e) {
                console.error(e)
            }
        }

        if (mediums.notification) {
            try {
                utilityFns.createBrowserNotification(`ITEM_WON.${listingId}`, title, message, [
                    { title: 'View listing' },
                ])
            } catch (e) {
                console.error(e)
            }
        }

        if (mediums.webhooks) {
            try {
                webhookFns.call({
                    event: 'item_won',
                    title,
                    message,
                    listingUrl: `${data.urls.listings}/${listingId}`,
                    listingName,
                })
            } catch (e) {
                console.error(e)
            }
        }
    },
}

// kotn apis
const apiFns = {
    call: async (url, method = 'GET', data, asJson = true) => {
        const headers = {
            'X-XSRF-TOKEN': await utilityFns.readCookie('XSRF-TOKEN'),
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
        const page = await apiFns.call(url, 'GET', undefined, false)

        return page
            ?.split("\n")
            ?.find((line) => line.includes(searchText))
            ?.trim()
    },

    bid: (listingId, bid) => apiFns.call(`${data.urls.base}/listings/${listingId}/bid`, 'POST', { bid }),

    watch: (listingId) => apiFns.call(`${data.urls.base}/listings/${listingId}/watch`, 'POST'),

    ignore: (listingId) => apiFns.call(`${data.urls.base}/listings/${listingId}/ignore`, 'POST'),

    refresh: (listingIds) => apiFns.call(`${data.urls.base}/listings/refresh`, 'POST', { ids: listingIds }),

    scrapeWatchedListings: async () => {
        const searchText = 'var listingData = '
        const url = new URL(data.urls.watchedListings)
        url.searchParams.set('per_page', 100)

        async function getPage(pageNo = 1) {
            url.searchParams.set('page', pageNo)

            const page = await apiFns.call(url.href, 'GET', undefined, false)

            const line = page
                ?.split("\n")
                ?.find((line) => line.includes(searchText))
                ?.trim()

            const value = line.substr(0, line.length - 1).replace(searchText, '')

            const listings = await utilityFns.sendMessageToTab(data.tabIds[0], {
                action: 'SCRAPE_LISTING_NAMES',
                args: {
                    html: page,
                    listings: JSON.parse(value),
                },
            })

            if (Object.keys(listings).length == 100) {
                return { ...listings, ...await getPage(pageNo + 1) }
            }

            return listings
        }

        return await getPage(1)
    },

    scrapeListing: async (listingId) => {
        const page = await apiFns.call(`${data.urls.base}/listings/${listingId}`, 'GET', undefined, false)

        const searchText = 'var initialBids = '

        const line = page
            ?.split("\n")
            ?.find((line) => line.includes(searchText))
            ?.trim()

        const value = line.substr(0, line.length - 1).replace(searchText, '')

        const bids = JSON.parse(value)

        const name = await utilityFns.sendMessageToTab(data.tabIds[0], {
            action: 'SCRAPE_LISTING_NAME',
            args: page,
        })

        return {
            name,
            bids,
        }
    },
}

// webhook functions
const webhookFns = {
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
    SHOW_WATCHED_LISTINGS: async (args, sender) => {
        listingFns.openWatchedListingsTab()
    },

    TEST_ENDING_WINNING_NOTIFICATION: async (args, sender) => {
        notificationFns.endingSoonButWinning({ sound: true, webhooks: true, notification: true}, 'TEST', 5)
    },

    TEST_ENDING_LOSING_NOTIFICATION: async (args, sender) => {
        notificationFns.endingSoonAndLosing({ sound: true, webhooks: true, notification: true}, 'TEST', 5, 10)
    },

    TEST_OUTBID_NOTIFICATION: async (args, sender) => {
        notificationFns.outbid({ sound: true, webhooks: true, notification: true}, 'TEST', 5, 10, 15)
    },

    TEST_ITEM_WON_NOTIFICATION: async (args, sender) => {
        notificationFns.itemWon({ sound: true, webhooks: true, notification: true}, 'TEST')
    },

    ANY_OPENED: async (args, sender) => {
        // check if the tab has already been opened (meaning this is a refresh)
        if (data.tabIds.includes(sender.tab.id)) {
            // if tab was being used for comms before being refresh re-enable comms
            if (data.tabIds[0] == sender.tab.id) {
                console.log(`Enabling comms via tab ${sender.tab.id} again due to page change or refresh`)
                utilityFns.sendMessageToTab(sender.tab.id, { action: 'ENABLE_COMMS' })
            }
            // new tab opened
        } else {
            // add the tab id to the list
            data.tabIds.push(sender.tab.id)

            // if this is the first/only tab, then use it for comms
            if (data.tabIds.length == 1) {
                data.watchedListingsLoading = true
                data.watchedListingsLoadingPromise = utilityFns.createPromise()

                listingFns.unmonitorListings(data.watchedListings)
                await listingFns.monitorListings(await apiFns.scrapeWatchedListings())

                data.watchedListingsLoading = false
                data.watchedListingsLoadingPromise.resolve()

                console.log(`Enabling comms via tab ${sender.tab.id}`)
                utilityFns.sendMessageToTab(sender.tab.id, { action: 'ENABLE_COMMS' })
            }
        }
    },

    ANY_INJECTED: async (args, sender) => {

    },

    WS_CONNECTED: async (args, sender) => {
        utilityFns.updateBadge('ON', 'green')
    },

    WS_DISCONNECTED: async (args, sender) => {
        utilityFns.updateBadge('')
    },

    AUCTIONS_OPENED: async (args, sender) => {

    },

    AUCTIONS_INJECTED: async (args, sender) => {
        // check if friends are bidding on items (limit to 15 requests at a time)
        const queue = {
            todo: Object.keys(args.listings),
            processing: [],
            completed: [],
        }

        function processNextBatch() {
            if (queue.processing.length <= 15) {
                const idsToProcess = queue.todo.slice(0, 15 - queue.processing.length)

                idsToProcess.forEach(async (listingIdToProcess) => {
                    // move id from waiting to inProgress
                    queue.todo = queue.todo.filter((listingId) => listingId != listingIdToProcess)
                    queue.processing.push(listingIdToProcess)

                    // check the listing
                    const listing = args.listings[listingIdToProcess]

                    const { bids, name } = await apiFns.scrapeListing(listingIdToProcess)

                    listing.id = listingIdToProcess
                    listing.bids = bids
                    listing.name = name

                    listingFns.checkIfFriendsBidding(listing, sender.tab.id)

                    // move id from inProgress to complete
                    queue.processing = queue.processing.filter((listingId) => listingId != listingIdToProcess)
                    queue.completed.push(listingIdToProcess)

                    processNextBatch()
                })
            }
        }

        processNextBatch()
    },

    LISTING_OPENED: async (args, sender) => {

    },

    LISTING_INECTED: async (args, sender) => {
        // check if friends are bidding on item
        listingFns.checkIfFriendsBidding(args.listing, sender.tab.id)
    },

    WATCHED_LISTINGS_OPENED: async (args, sender) => {
        // let the new tab know about friend bids
        if (data.watchedListingsLoading) {
            await data.watchedListingsLoadingPromise.promise
        }

        Object.entries(data.watchedListings).forEach(([listingId, listing]) => {
            listingFns.checkIfFriendsBidding(listing, sender.tab.id)
        })
    },

    WATCHED_LISTINGS_INJECTED: async (args, sender) => {
        if (args.username != data.username) {
            await chrome.storage.sync.set({
                'options.user.username': args.username,
            })

            data.username = args.username
        }
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

                listingFns.checkIfFriendsBidding(data.watchedListings[args.listing_id])
            }
        }

        // TODO send to auction pages as well
    },

    WATCH_STATE_CHANGED: async (args, sender) => {
        // eg: { "listing_id": 974742, "state": "ignore" }
        // known states: "bid", "watch", "ignore", null

        // refresh watched listings page if the item isn't on it
        // if (args.listing_id in data.watchedListings == false) {
        //     listingFns.reloadWatchedListingsTabs()
        // }

        // try to find listing in cache
        const listing = data.watchedListings[args.listing_id]

        // if we should monitor this listing
        if (['bid', 'watch'].includes(args.state)) {
            if (listing) {
                listingFns.monitorListings({ [args.listing_id]: listing })
            } else {
                listingFns.monitorListings({ [args.listing_id]: (await apiFns.refresh([args.listing_id]))[args.listing_id] })
            }
        // if we should unmonitor this listing
        } else {
            if (listing) {
                listingFns.unmonitorListings({ [args.listing_id]: listing })
            }
        }
    },

    OUTBID: async (args, sender) => {
        // eg: { "user_id": 17965, "listing_id": 974702, "previous_bid": 2, "current_bid": 3 }

        const notifcationActions = {
            'disabled': async () => {
                return
            },
            'always': async () => {
                const listingDetail = (await apiFns.refresh([args.listing_id]))[args.listing_id]

                notificationFns.outbid({ sound: true, notification: true}, args.listing_id, args.previous_bid, args.current_bid, listingDetail.bid + listingDetail.bid_increment)
            },
            'last2minutes': async () => {
                const listingDetail = (await apiFns.refresh([args.listing_id]))[args.listing_id]
                const endTime = moment(listingDetail.end)
                const twoMinsFromEndTime = moment(endTime).subtract(2, 'minutes')

                // check if auction is ending
                if (moment().isBetween(twoMinsFromEndTime, endTime)) {
                    notificationFns.outbid({ sound: true, notification: true}, args.listing_id, args.previous_bid, args.current_bid, listingDetail.bid + listingDetail.bid_increment)
                }
            },
        }

        const webhooksActions = {
            'disabled': async () => {
                return
            },
            'always': async () => {
                const listingDetail = (await apiFns.refresh([args.listing_id]))[args.listing_id]

                notificationFns.outbid({ webhooks: true }, args.listing_id, args.previous_bid, args.current_bid, listingDetail.bid + listingDetail.bid_increment)
            },
            'last2minutes': async () => {
                const listingDetail = (await apiFns.refresh([args.listing_id]))[args.listing_id]
                const endTime = moment(listingDetail.end)
                const twoMinsFromEndTime = moment(endTime).subtract(2, 'minutes')

                // check if auction is ending
                if (moment().isBetween(twoMinsFromEndTime, endTime)) {
                    notificationFns.outbid({ webhooks: true }, args.listing_id, args.previous_bid, args.current_bid, listingDetail.bid + listingDetail.bid_increment)
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
                notificationFns.itemWon({ sound: true, notification: true}, args.listing_id)
            },
        }

        const webhooksActions = {
            'disabled': async () => {
                return
            },
            'always': async () => {
                notificationFns.itemWon({ webhooks: true }, args.listing_id)
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
        listingFns.openWatchedListingsTab()
    },

    ENDING_WINNING: (buttonIndex, [ listingId ]) => {
        if (listingId == 'TEST') {
            return listingFns.openWatchedListingsTab()
        }

        switch (buttonIndex) {
            // no button
            case -1:
            // view button
            case 0:
                // tabs.openListing(listingId)
                listingFns.openWatchedListingsTab()
            break
        }
    },

    ENDING_LOSING: (buttonIndex, [ listingId, nextBid ]) => {
        if (listingId == 'TEST') {
            return listingFns.openWatchedListingsTab()
        }

        switch (buttonIndex) {
            // no button
            case -1:
                // tabs.openListing(listingId)
                listingFns.openWatchedListingsTab()
            break

            // unwatch button
            case 0:
                if (listingId == 'TEST') {
                    break
                }

                apiFns.ignore(listingId)
            break

            // bid button
            case 1:
                if (listingId == 'TEST') {
                    break
                }

                apiFns.bid(listingId, nextBid)
            break
        }
    },

    OUTBID: (buttonIndex, [ listingId, nextBid ]) => {
        if (listingId == 'TEST') {
            return listingFns.openWatchedListingsTab()
        }

        switch (buttonIndex) {
            // no button
            case -1:
                // tabs.openListing(listingId)
                listingFns.openWatchedListingsTab()
            break

            // unwatch button
            case 0:
                if (listingId == 'TEST') {
                    break
                }

                apiFns.ignore(listingId)
            break

            // bid button
            case 1:
                if (listingId == 'TEST') {
                    break
                }

                apiFns.bid(listingId, nextBid)
            break
        }
    },

    ITEM_WON: (buttonIndex, [ listingId ]) => {
        if (listingId == 'TEST') {
            return listingFns.openWatchedListingsTab()
        }

        switch (buttonIndex) {
            // no button
            case -1:
                // pass
            break

            // view button
            case 0:
                listingFns.openListingTab(listingId)
            break
        }
    }
}

const data = {
    urls: {
        base: 'https://kotnauction.com',
        auctions: 'https://kotnauction.com/auctions',
        listings: 'https://kotnauction.com/listings',
        watchedListings: 'https://kotnauction.com/listings/watched',
    },
    tabIds: [],
    username: null,
    watchedListings: {},
    watchedListingsLoading: false,
    watchedListingsLoadingPromise: null,
}

// listen for extension installation
chrome.runtime.onInstalled.addListener(async ({ reason, version }) => {
    if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
        utilityFns.playSound('yay')

        utilityFns.createBrowserNotification('INSTALLED', `Extension installed`, 'Yay!')
    }
})

// listen for extension messages
chrome.runtime.onMessage.addListener((message, sender, respond) => {
    console.log(message, sender?.tab?.id)

    if (message.action in messageHandlers) {
        messageHandlers[message.action](message.args, sender).then((response) => {
            if (response) {
                respond(response)
            }
        })
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
    const commsTabId = data.tabIds[0]

    // if a comms tab has navigated away from kotn
    if (data.tabIds.includes(updatedTabId) && 'url' in tab == false) {
        // remove the tab id from the list
        data.tabIds = data.tabIds.filter((tabId) => tabId != updatedTabId)

        // if the tab used for comms is no longer open
        if (data.tabIds.includes(commsTabId) == false) {
            // clear timeouts
            Object.entries(data.watchedListings).forEach(([listingId, listing]) => {
                clearTimeout(listing.timeout)
            })

            // if there are other tabs that can be used for comms
            if (data.tabIds.length) {
                // use the first one in the list
                console.log(`Enabling comms via tab ${data.tabIds[0]} due to tab ${commsTabId} navigating away`)
                utilityFns.sendMessageToTab(data.tabIds[0], { action: 'ENABLE_COMMS' })
            } else {
                utilityFns.updateBadge('')
                listingFns.unmonitorListings(data.watchedListings)
                console.log('No tabs available for comms.')

                if (data.watchedListingsLoading) {
                    data.watchedListingsLoadingPromise.reject()
                }
            }
        }
    }
})

// listen for tab closings
chrome.tabs.onRemoved.addListener(( removedTabId ) => {
    const commsTabId = data.tabIds[0]

    // remove the closed tab id from the list
    data.tabIds = data.tabIds.filter((tabId) => tabId != removedTabId)

    // if the tab used for comms is no longer open
    if (data.tabIds.includes(commsTabId) == false) {
        // clear timeouts
        Object.entries(data.watchedListings).forEach(([listingId, listing]) => {
            clearTimeout(listing.timeout)
        })

        // if there are other tabs that can be used for comms
        if (data.tabIds.length) {
            // use the first one in the list
            console.log(`Enabling comms via tab ${data.tabIds[0]} due to tab ${commsTabId} closing`)
            utilityFns.sendMessageToTab(data.tabIds[0], { action: 'ENABLE_COMMS' })
        } else {
            utilityFns.updateBadge('')
            listingFns.unmonitorListings(data.watchedListings)
            console.log('No tabs available for comms.')

            if (data.watchedListingsLoading) {
                data.watchedListingsLoadingPromise.reject()
            }
        }
    }
})

chrome.runtime.onStartup.addListener(() => {
    console.log('Startup event')
})


chrome.runtime.onSuspend.addListener(() => {
    console.log('Suspend event')

    if (data.watchedListingsLoading) {
        data.watchedListingsLoadingPromise.reject()
    }
})

// get username on startup
const storageKeys = ['options.user.username']
chrome.storage.sync.get(storageKeys).then((storedData) => {
    data.username = storedData[storageKeys[0]] || null
})
