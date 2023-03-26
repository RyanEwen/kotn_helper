import moment from '/lib/moment.js';

console.log('KotN Helper - Service Worker')

const listingsUrl = 'https://kotnauction.com/listings'
const watchedListingsUrl = 'https://kotnauction.com/listings/watched'

async function showWatchedListings() {
    const tabs = await chrome.tabs.query({ url: `${watchedListingsUrl}*` })

    if (tabs.length) {
        // focus existing tab and window
        chrome.tabs.update(tabs[0].id, { active: true })
        chrome.windows.update(tabs[0].windowId, { focused: true })
    } else {
        // open a new tab and focus window
        chrome.tabs.create({ url: `${watchedListingsUrl}?per-page=100` })
    }
}

async function showListing(id) {
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

function showNotification(id, title, message, buttons = undefined) {
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
        target: 'offscreen',
        type: 'play-sound',
        data: sound
    })
}

async function showAlert(message) {
    await setupOffscreenDoc()

    await chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'show-alert',
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

const api = {
    bid: (id, bid) => makeApiCall(`https://kotnauction.com/listings/${id}/bid`, 'POST', { bid }),
    watch: (id) => makeApiCall(`https://kotnauction.com/listings/${id}/watch`, 'POST'),
    ignore: (id) => makeApiCall(`https://kotnauction.com/listings/${id}/ignore`, 'POST'),
    refresh: (ids) => makeApiCall('https://kotnauction.com/listings/refresh', 'POST', { ids }),
}

async function notifyOutbid(listingId, previousBid, currentBid, nextBid) {
    await playSound('beeps')

    return showNotification(`outbid.${listingId}.${nextBid}`, "You've been outbid!", `Previous bid $${previousBid}, Current bid: $${currentBid}`, [
        { title: 'Unwatch' },
        { title: `Bid $${nextBid}` },
    ])
}

async function notifyItemWon() {
    await playSound('yay')

    return showNotification(`itemWon.${listing_id}`, 'Item Won', "You've won an item!", [
        { title: 'View listing' },
    ])
}

// handle messages from popup
const popupHandlers = {
    'showWatchedListings': (args) => {
        showWatchedListings()
    },
}

// handle messages from websockets
const websocketHandlers = {
    'BidPlaced': async (args) => {
        // {
        //     "id": 13841801,
        //     "listing_id": 974702,
        //     "bid": 3,
        //     "bidder": "yourguymike",
        //     "created_at": "2023-03-21 12:30:59",
        //     "listing_end": "2023-03-26 16:00:00",
        //     "socket": null
        // }
    },
    'WatchStateChanged': async (args) => {
        // {
        //     "listing_id": 974742,
        //     "state": "ignore",
        //     "socket": null
        // }

        // known states: "bid", "watch", "ignore", null

        // const detail = await api.refresh([974702])
        // notifyOutbid(974702, 8, 9, detail[974702].bid + detail[974702].bid_increment)
    },
    'BidderOutbid': async (args) => {
        // Note: happens before BidPlaced

        // {
        //     "user_id": 17965,
        //     "listing_id": 974702,
        //     "previous_bid": 2,
        //     "current_bid": 3,
        //     "socket": null
        // }

        const outbidKey = 'options.notifications.outbid'
        const storedData = await chrome.storage.sync.get(outbidKey)
        const notificationSetting = storedData[outbidKey]

        if (notificationSetting == 'disabled') {
            return
        }

        const detail = await api.refresh([args.listing_id])

        if (!notificationSetting || notificationSetting == 'last2minutes') {
            const endTime = moment(detail[args.listing_id].end)
            const twoMinsFromEndTime = moment(endTime).subtract(2, 'minutes')

            // check if auction is ending
            if (moment().isBetween(twoMinsFromEndTime, endTime) == false) {
                return
            }
        }

        if (notificationSetting == 'always') {
            // pass
        }

        notifyOutbid(args.listing_id, args.previous_bid, args.current_bid, detail[args.listing_id].bid + detail[args.listing_id].bid_increment)
    },
    'ItemWon': async (args) => {
        const outbidKey = 'options.notifications.outbid'
        const storedData = await chrome.storage.sync.get(outbidKey)
        const notificationSetting = storedData[outbidKey]

        switch(notificationSetting) {
            case 'disabled':
                // pass
            break

            case 'always':
            default:
                notifyItemWon(args)
            break
        }
    },
}

const notificationHandlers = {
    outbid: (index, [ listingid, nextBid ]) => {
        switch (index) {
            // view
            case -1:
                showListing(listingid)
            break

            // unwatch
            case 0:
                api.ignore(listingid)
            break

            // bid
            case 1:
                api.bid(listingid, nextBid)
            break
        }
    },
    itemWon: (index, [ listing_id, ...others ]) => {
        switch (index) {
            // views
            case 0:
                showListing(listing_id)
            break
        }
    }
}

// installation handler
chrome.runtime.onInstalled.addListener(async ({ reason, version }) => {
    if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
        await playSound('yay')

        showNotification('installed', 'Extension installed', 'Yay!')
    }
})

// message handler
chrome.runtime.onMessage.addListener(message => {
    if (message.target !== 'ServiceWorker') {
        return
    }

    console.log('KotNHelper service worker received', message)

    if (message.type == 'PopupMessage' && message.data.action in popupHandlers) {
        return popupHandlers[message.data.action](message.data.args)
    }

    // TODO only listen for events from the one tab at a time
    if (message.type == 'WebsocketMessage' && message.data.type in websocketHandlers) {
        return websocketHandlers[message.data.type](message.data.args)
    }

    console.warn(`Unexpected message type received: '${message.type}'.`)
})

chrome.notifications.onClicked.addListener(id => {
    const [ type, ...details ] = id.split('.')

    if (type in notificationHandlers) {
        notificationHandlers[type](-1, details)
    }
})

chrome.notifications.onButtonClicked.addListener((id, index) => {
    const [ type, ...details ] = id.split('.')

    if (type in notificationHandlers) {
        notificationHandlers[type](index, details)
    }
})
