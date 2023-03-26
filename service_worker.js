console.log('KotN Helper - Service Worker')

import moment from '/lib/moment.js';

const listingsUrl = 'https://kotnauction.com/listings'

const watchedListingsUrl = 'https://kotnauction.com/listings/watched'

let watchedListings = {}

async function openWatchedListings() {
    const tabs = await chrome.tabs.query({ url: `${watchedListingsUrl}*` })

    if (tabs.length) {
        // focus existing tab and window
        chrome.tabs.update(tabs[0].id, { active: true })
        chrome.windows.update(tabs[0].windowId, { focused: true })
    } else {
        // open a new tab and focus window
        chrome.tabs.create({ url: `${watchedListingsUrl}?per_page=100` })
    }
}

async function openListing(id) {
    const tabs = await chrome.tabs.query({ url: `${listingsUrl}/${id}*` })

    if (tabs.length) {
        // focus existing tab and window
        chrome.tabs.update(tabs[0].id, { active: true })
        chrome.windows.update(tabs[0].windowId, { focused: true })
    } else {
        // open a new tab and focus window
        chrome.tabs.create({ url: `${listingsUrl}/${id}` })
    }
}

function createNotification(id, title, message, buttons = undefined) {
    return chrome.notifications.create(id, {
        type: 'basic',
        title,
        message,
        buttons,
        iconUrl: 'images/icon-48.jpeg',
        requireInteraction: true,
    })
}

function updateBadge(text) {
    chrome.action.setBadgeBackgroundColor({ color: 'red' })
    chrome.action.setBadgeText({ text })
}

async function playSound(sound) {
    await setupOffscreenDoc()

    await chrome.runtime.sendMessage({
        target: 'OFFSCREEN',
        type: 'PLAY_SOUND',
        data: sound
    })
}

async function showAlert(message) {
    await setupOffscreenDoc()

    await chrome.runtime.sendMessage({
        target: 'OFFSCREEN',
        type: 'SHOW_ALERT',
        data: message
    })
}

async function setupOffscreenDoc() {
    const path = 'offscreen.html'

    if (!(await hasOffscreenDocument(path))) {
        await chrome.offscreen.createDocument({
            url: chrome.runtime.getURL(path),
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Play a sound',
        })
    }
}

async function hasOffscreenDocument(path) {
    const offscreenUrl = chrome.runtime.getURL(path)
    const matchedClients = await clients.matchAll()

    for (const client of matchedClients) {
        if (client.url === offscreenUrl) {
            return true
        }
    }

    return false
}

async function notifyOutbid(mediums, listingId, previousBid, currentBid, nextBid) {
    if (mediums.sound) {
        await playSound('beeps')
    }

    if (mediums.notification) {
        createNotification(`OUTBID.${listingId}.${nextBid}`, "You've been outbid!", `Previous bid $${previousBid}, Current bid: $${currentBid}`, [
            { title: 'Unwatch' },
            { title: `Bid $${nextBid}` },
        ])
    }

    if (mediums.ifttt) {
        makeIftttWebhookCall('kotn_outbid', {
            text: `You've been outbid! Previous bid $${previousBid}, Current bid: $${currentBid}`,
            listingUrl: `${listingsUrl}/${listingId}`,
        })
    }
}

async function notifyItemWon(mediums, listingId) {
    if (mediums.sound) {
        await playSound('yay')
    }

    if (mediums.notification) {
        createNotification(`ITEM_WON.${listingId}`, 'Item Won', "You've won an item!", [
            { title: 'View listing' },
        ])
    }

    if (mediums.ifttt) {
        makeIftttWebhookCall('kotn_item_won', {
            text: "You've won an item!",
            listingUrl: `${listingsUrl}/${listingId}`,
        })
    }
}

async function readCookie(name) {
    const cookie = await chrome.cookies.get({ name, url: 'https://kotnauction.com' })

    return decodeURIComponent(cookie.value)
}

async function makeApiCall(url, method = 'GET', data) {
    const headers = {
        'X-XSRF-TOKEN': await readCookie('XSRF-TOKEN'),
        'Accept': 'application/json, text/plain, */*',
    }

    if (data) {
        headers['Content-Type'] = 'application/json'
    }

    const body = data ? JSON.stringify(data) : undefined

    const request = await fetch(url, { headers, body, method })

    return request.json()
}

const ApiCalls = {
    bid: (id, bid) => makeApiCall(`https://kotnauction.com/listings/${id}/bid`, 'POST', { bid }),
    watch: (id) => makeApiCall(`https://kotnauction.com/listings/${id}/watch`, 'POST'),
    ignore: (id) => makeApiCall(`https://kotnauction.com/listings/${id}/ignore`, 'POST'),
    refresh: (ids) => makeApiCall('https://kotnauction.com/listings/refresh', 'POST', { ids }),
}

async function makeIftttWebhookCall(eventName, data) {
    const storageKey = 'options.ifttt.webhookKey'
    const storedData = await chrome.storage.sync.get(storageKey)
    const key = storedData[storageKey]

    if (!key) {
        return
    }

    const headers = {}

    if (data) {
        headers['Content-Type'] = 'application/json'
    }

    const body = data ? JSON.stringify(data) : undefined

    await fetch(`https://maker.ifttt.com/trigger/${eventName}/json/with/key/${key}`, { headers, body, method: 'POST', mode: 'no-cors' })
}

const PopupHandlers = {
    SHOW_WATCHED_LISTINGS: () => {
        openWatchedListings()
    },

    TEST_OUTBID_NOTIFICATION: () => {
        notifyOutbid({ sound: true, ifttt: true, notification: true}, 111111, 5, 10, 15)
    },

    TEST_ITEM_WON_NOTIFICATION: () => {
        notifyItemWon({ sound: true, ifttt: true, notification: true}, 111111)
    },
}

const WebsocketHandlers = {
    PAGE_LOAD: async (args) => {
        watchedListings = args.listingData
    },

    BID_PLACED: async (args) => {
        // eg: { "id": 13841801, "listing_id": 974702, "bid": 3, "bidder": "yourguymike", "created_at": "2023-03-21 12:30:59", "listing_end": "2023-03-26 16:00:00" }

        watchedListings = args.listingData
    },

    WATCH_STATE_CHANGED: async (args) => {
        // eg: { "listing_id": 974742, "state": "ignore" }
        // known states: "bid", "watch", "ignore", null

        watchedListings = args.listingData
    },

    OUTBID: async (args) => {
        // eg: { "user_id": 17965, "listing_id": 974702, "previous_bid": 2, "current_bid": 3 }

        watchedListings = args.listingData

        const noticiationActions = {
            'disabled': async () => {
                return
            },
            'always': async () => {
                const detail = await ApiCalls.refresh([args.listing_id])

                notifyOutbid({ sound: true, notification: true}, args.listing_id, args.previous_bid, args.current_bid, detail[args.listing_id].bid + detail[args.listing_id].bid_increment)
            },
            'last2minutes': async () => {
                const detail = await ApiCalls.refresh([args.listing_id])
                const endTime = moment(detail[args.listing_id].end)
                const twoMinsFromEndTime = moment(endTime).subtract(2, 'minutes')

                // check if auction is ending
                if (moment().isBetween(twoMinsFromEndTime, endTime)) {
                    notifyOutbid({ sound: true, notification: true}, args.listing_id, args.previous_bid, args.current_bid, detail[args.listing_id].bid + detail[args.listing_id].bid_increment)
                }
            },
        }

        const iftttActions = {
            'disabled': async () => {
                return
            },
            'always': async () => {
                const detail = await ApiCalls.refresh([args.listing_id])

                notifyOutbid({ ifttt: true }, args.listing_id, args.previous_bid, args.current_bid, detail[args.listing_id].bid + detail[args.listing_id].bid_increment)
            },
            'last2minutes': async () => {
                const detail = await ApiCalls.refresh([args.listing_id])
                const endTime = moment(detail[args.listing_id].end)
                const twoMinsFromEndTime = moment(endTime).subtract(2, 'minutes')

                // check if auction is ending
                if (moment().isBetween(twoMinsFromEndTime, endTime)) {
                    notifyOutbid({ ifttt: true }, args.listing_id, args.previous_bid, args.current_bid, detail[args.listing_id].bid + detail[args.listing_id].bid_increment)
                }
            },
        }

        const storageKeys = ['options.notifications.outbid', 'options.ifttt.outbid']
        const storedData = await chrome.storage.sync.get(storageKeys)
        const notificationSetting = storedData[storageKeys[0]] || 'last2minutes'
        const iftttSetting = storedData[storageKeys[1]] || 'last2minutes'

        // execute the notification action based on the setting
        if (notificationSetting in noticiationActions) {
            noticiationActions[notificationSetting]()
        }

        // execute the ifttt action based on the setting
        if (iftttSetting in iftttActions) {
            iftttActions[iftttSetting]()
        }
    },

    ITEM_WON: async (args) => {
        watchedListings = args.listingData

        const noticiationActions = {
            'disabled': async () => {
                return
            },
            'always': async () => {
                notifyItemWon({ sound: true, notification: true}, args.listing_id)
            },
        }

        const iftttActions = {
            'disabled': async () => {
                return
            },
            'always': async () => {
                notifyItemWon({ ifttt: true }, args.listing_id)
            },
        }

        const storageKeys = ['options.notifications.itemWon', 'options.ifttt.itemWon']
        const storedData = await chrome.storage.sync.get(storageKeys)
        const notificationSetting = storedData[storageKeys[0]] || 'always'
        const iftttSetting = storedData[storageKeys[1]] || 'always'

        // execute the notification action based on the setting
        if (notificationSetting in noticiationActions) {
            noticiationActions[notificationSetting]()
        }

        // execute the ifttt action based on the setting
        if (iftttSetting in iftttActions) {
            iftttActions[iftttSetting]()
        }
    },
}

const NotificationHandlers = {
    INSTALLED: () => {
        openWatchedListings()
    },

    OUTBID: (buttonIndex, [ listingid, nextBid ]) => {
        switch (buttonIndex) {
            // no button
            case -1:
                openListing(listingid)
            break

            // unwatch button
            case 0:
                ApiCalls.ignore(listingid)
            break

            // bid button
            case 1:
                ApiCalls.bid(listingid, nextBid)
                openListing(listingid)
            break
        }
    },

    ITEM_WON: (buttonIndex, [ listing_id, ...others ]) => {
        switch (buttonIndex) {
            // no button
            case -1:
            // view button
            case 0:
                openListing(listing_id)
            break
        }
    }
}

// installation handler
chrome.runtime.onInstalled.addListener(async ({ reason, version }) => {
    if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
        await playSound('yay')

        createNotification('INSTALLED', 'Extension installed', 'Yay!')
    }
})

// message handler
chrome.runtime.onMessage.addListener((message) => {
    if (message.target !== 'SERVICE_WORKER') {
        return
    }

    console.log('KotNHelper service worker received', message)

    if (message.type == 'POPUP_MESSAGE' && message.data.action in PopupHandlers) {
        return PopupHandlers[message.data.action](message.data.args)
    }

    // TODO only listen for events from the one tab at a time
    if (message.type == 'WEBSOCKET_MESSAGE' && message.data.type in WebsocketHandlers) {
        return WebsocketHandlers[message.data.type](message.data.args)
    }

    console.warn(`Unexpected message type received: '${message.type}'.`)
})

// notification click handler
chrome.notifications.onClicked.addListener((id) => {
    const [ type, ...details ] = id.split('.')

    if (type in NotificationHandlers) {
        NotificationHandlers[type](-1, details)
    } else {
        console.warn(`Unexpected message type received: '${type}'.`)
    }
})

// notification button click handler
chrome.notifications.onButtonClicked.addListener((id, index) => {
    const [ type, ...details ] = id.split('.')

    if (type in NotificationHandlers) {
        NotificationHandlers[type](index, details)
    } else {
        console.warn(`Unexpected message type received: '${type}'.`)
    }
})
