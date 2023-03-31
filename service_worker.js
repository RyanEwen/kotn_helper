console.log('KotN Helper - Service Worker')

import moment from '/lib/moment.js';

const data = {
    urls: {
        listings: 'https://kotnauction.com/listings',
        watchedListings: 'https://kotnauction.com/listings/watched',
    },
    watchedListingsTabIds: [],
    userId: null,
    username: null,
    watchedListings: {},
}

async function openOrFocusTab(urlMatch, url) {
    const tabs = await chrome.tabs.query({ url: urlMatch })

    if (tabs.length) {
        // focus existing tab and window
        chrome.tabs.update(tabs[0].id, { active: true })
        chrome.windows.update(tabs[0].windowId, { focused: true })
    } else {
        // open a new tab and focus window
        chrome.tabs.create({ url })
    }
}

async function reloadTab(urlMatch) {
    const tabs = await chrome.tabs.query({ url: urlMatch })

    if (tabs.length) {
        chrome.tabs.reload(tabs[0].id)
    }
}

async function openWatchedListings() {
    openOrFocusTab(`${data.urls.watchedListings}*`, `${data.urls.watchedListings}?per_page=100`)
}

async function reloadWatchedListings() {
    reloadTab(`${data.urls.watchedListings}*`)
}

async function openListing(id) {
    openOrFocusTab(`${data.urls.listings}/${id}*`, `${data.urls.listings}/${id}`)
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

function clearBadge() {
    updateBadge('')
}

function updateBadge(text, color) {
    chrome.action.setBadgeText({ text })

    if (color) {
        chrome.action.setBadgeBackgroundColor({ color })
    }
}

async function playSound(sound) {
    await setupOffscreenDoc()

    await chrome.runtime.sendMessage({
        action: 'PLAY_SOUND',
        args: sound,
    })
}

async function setupOffscreenDoc() {
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
}

async function notifyEndingSoonButWinning(mediums, listingId, currentBid) {
    const listingName = listingId == 'TEST' ? 'TEST ITEM ' : (data.watchedListings[listingId].name || '')

    if (mediums.sound) {
        playSound('beeps')
    }

    if (mediums.notification) {
        createNotification(`ENDING_WINNING.${listingId}`, "Listing ending soon!", `$${currentBid} (you) - ${listingName}`, [
            { title: 'View Listing' },
        ])
    }

    if (mediums.webhooks) {
        makeWebhookCalls({
            event: 'listing_ending_soon_winning',
            text: "Listing ending soon!",
            listingUrl: `${data.urls.listings}/${listingId}`,
            listingName,
            currentBid,
        })
    }
}

async function notifyEndingSoonAndLosing(mediums, listingId, currentBid, nextBid) {
    const listingName = listingId == 'TEST' ? 'TEST ITEM ' : (data.watchedListings[listingId].name || '')

    if (mediums.sound) {
        playSound('beeps')
    }

    if (mediums.notification) {
        createNotification(`ENDING_LOSING.${listingId}.${nextBid}`, "Listing ending soon!", `$${currentBid} - ${listingName}`, [
            { title: 'Unwatch' },
            { title: `Bid $${nextBid}` },
        ])
    }

    if (mediums.webhooks) {
        makeWebhookCalls({
            event: 'listing_ending_soon_losing',
            text: "Listing ending soon!",
            listingUrl: `${data.urls.listings}/${listingId}`,
            listingName,
            currentBid,
            nextBid,
        })
    }
}

async function notifyOutbid(mediums, listingId, previousBid, currentBid, nextBid) {
    const listingName = listingId == 'TEST' ? 'TEST ITEM ' : (data.watchedListings[listingId].name || '')

    if (mediums.sound) {
        playSound('beeps')
    }

    if (mediums.notification) {
        createNotification(`OUTBID.${listingId}.${nextBid}`, "You've been outbid!", `$${currentBid} - ${listingName}`, [
            { title: 'Unwatch' },
            { title: `Bid $${nextBid}` },
        ])
    }

    if (mediums.webhooks) {
        makeWebhookCalls({
            event: 'outbid',
            text: "You've been outbid!",
            listingUrl: `${data.urls.listings}/${listingId}`,
            listingName,
            previousBid,
            currentBid,
            nextBid,
        })
    }
}

async function notifyItemWon(mediums, listingId) {
    const listingName = listingId == 'TEST' ? 'TEST ITEM ' : (data.watchedListings[listingId].name || '')

    if (mediums.sound) {
        playSound('yay')
    }

    if (mediums.notification) {
        createNotification(`ITEM_WON.${listingId}`, 'Item won!', listingName, [
            { title: 'View listing' },
        ])
    }

    if (mediums.webhooks) {
        makeWebhookCalls({
            event: 'item_won',
            text: "You've won an item!",
            listingUrl: `${data.urls.listings}/${listingId}`,
            listingName,
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

async function makeWebhookCalls(data) {
    const storageKey = 'options.webhooks.urls'
    const storedData = await chrome.storage.sync.get(storageKey)
    const urls = (storedData[storageKey] || '').split("\n")

    urls.forEach((url) => {
        const headers = {}

        if (data) {
            headers['Content-Type'] = 'application/json'
        }

        const body = data ? JSON.stringify(data) : undefined

        fetch(url, { headers, body, method: 'POST', mode: 'no-cors' })
    })
}

const actionHandlers = {
    SHOW_WATCHED_LISTINGS: (args, sender) => {
        openWatchedListings()
    },

    TEST_OUTBID_NOTIFICATION: (args, sender) => {
        notifyOutbid({ sound: true, webhooks: true, notification: true}, 'TEST', 5, 10, 15)
    },

    TEST_ITEM_WON_NOTIFICATION: (args, sender) => {
        notifyItemWon({ sound: true, webhooks: true, notification: true}, 'TEST')
    },

    WATCHED_LISTINGS_OPENED: async (args, sender) => {
        // check if the tab has already been opened (meaning this is a refresh)
        if (data.watchedListingsTabIds.includes(sender.tab.id)) {
            // if tab used for comms is being refreshed, re-enable it
            if (data.watchedListingsTabIds[0] == sender.tab.id) {
                console.log(`Enabling comms via tab ${sender.tab.id} again due to refresh`)
                chrome.tabs.sendMessage(sender.tab.id, { action: 'ENABLE_COMMS' })
                updateBadge('OK', 'green')
            }
        } else {
            // tab is new so add the id to the list
            data.watchedListingsTabIds.push(sender.tab.id)

            // if this is the only tab then use it to for comms
            if (data.watchedListingsTabIds.length == 1) {
                console.log(`Enabling comms via tab ${sender.tab.id}`)
                chrome.tabs.sendMessage(sender.tab.id, { action: 'ENABLE_COMMS' })
                updateBadge('OK', 'green')
            }
        }
    },

    WATCHED_LISTINGS_CONNECTED: async (args, sender) => {
        data.userId = args.userId

        data.username = args.username

        // clear old timeouts
        Object.entries(data.watchedListings).forEach(([listingId, listing]) => {
            clearTimeout(listing.timeout)
        })

        // recreate watchedListings with test listing
        data.watchedListings = args.watchedListings

        // create new timeouts
        Object.entries(data.watchedListings).forEach(([listingId, listing]) => {
            const endTime = moment(listing.end)
            const twoMinsFromEndTime = moment(endTime).subtract(2, 'minutes')

            // don't notify if already ending right now
            if (moment().isBetween(twoMinsFromEndTime, endTime)) {
                return
            }

            // get 2m5s before endTime in ms
            const milisecondsFromNow = moment(twoMinsFromEndTime).subtract(5, 'seconds').diff()

            // run notify code 2m5s before endTime
            listing.timeout = setTimeout(async () => {
                const detail = await ApiCalls.refresh([listingId])

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
                            notifyEndingSoonButWinning({ sound: true, notification: true}, listingId, detail[listingId].bid)
                        } else {
                            notifyEndingSoonAndLosing({ sound: true, notification: true}, listingId, detail[listingId].bid, detail[listingId].bid + detail[listingId].bid_increment)
                        }
                    },
                    'unlessWinning': async () => {
                        if (detail[listingId].bidder == data.username) {
                            return
                        }

                        notifyEndingSoonAndLosing({ sound: true, notification: true}, listingId, detail[listingId].bid, detail[listingId].bid + detail[listingId].bid_increment)
                    },
                }

                const webhooksActions = {
                    'disabled': async () => {
                        return
                    },
                    'always': async () => {
                        if (detail[listingId].bidder == data.username) {
                            notifyEndingSoonButWinning({ webhooks: true }, listingId, detail[listingId].bid)
                        } else {
                            notifyEndingSoonAndLosing({ webhooks: true }, listingId, detail[listingId].bid, detail[listingId].bid + detail[listingId].bid_increment)
                        }
                    },
                    'unlessWinning': async () => {
                        if (detail[listingId].bidder == data.username) {
                            return
                        }

                        notifyEndingSoonAndLosing({ webhooks: true }, listingId, detail[listingId].bid, detail[listingId].bid + detail[listingId].bid_increment)
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
    },

    WATCH_STATE_CHANGED: async (args, sender) => {
        // eg: { "listing_id": 974742, "state": "ignore" }
        // known states: "bid", "watch", "ignore", null

        // refresh watched listings page if the item isn't on it
        if (args.listing_id in data.watchedListings == false) {
            reloadWatchedListings()
        }
    },

    OUTBID: async (args, sender) => {
        // eg: { "user_id": 17965, "listing_id": 974702, "previous_bid": 2, "current_bid": 3 }

        const notifcationActions = {
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

        const webhooksActions = {
            'disabled': async () => {
                return
            },
            'always': async () => {
                const detail = await ApiCalls.refresh([args.listing_id])

                notifyOutbid({ webhooks: true }, args.listing_id, args.previous_bid, args.current_bid, detail[args.listing_id].bid + detail[args.listing_id].bid_increment)
            },
            'last2minutes': async () => {
                const detail = await ApiCalls.refresh([args.listing_id])
                const endTime = moment(detail[args.listing_id].end)
                const twoMinsFromEndTime = moment(endTime).subtract(2, 'minutes')

                // check if auction is ending
                if (moment().isBetween(twoMinsFromEndTime, endTime)) {
                    notifyOutbid({ webhooks: true }, args.listing_id, args.previous_bid, args.current_bid, detail[args.listing_id].bid + detail[args.listing_id].bid_increment)
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
                notifyItemWon({ sound: true, notification: true}, args.listing_id)
            },
        }

        const webhooksActions = {
            'disabled': async () => {
                return
            },
            'always': async () => {
                notifyItemWon({ webhooks: true }, args.listing_id)
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

const notificationHandlers = {
    INSTALLED: () => {
        openWatchedListings()
    },

    ENDING_WINNING: (buttonIndex, [ listingId ]) => {
        switch (buttonIndex) {
            // no button
            case -1:
            // view button
            case 0:
                // openListing(listingId)
                openWatchedListings()
            break
        }
    },

    ENDING_LOSING: (buttonIndex, [ listingId, nextBid ]) => {
        switch (buttonIndex) {
            // no button
            case -1:
                // openListing(listingId)
                openWatchedListings()
            break

            // unwatch button
            case 0:
                ApiCalls.ignore(listingId)
            break

            // bid button
            case 1:
                ApiCalls.bid(listingId, nextBid)
            break
        }
    },

    OUTBID: (buttonIndex, [ listingId, nextBid ]) => {
        switch (buttonIndex) {
            // no button
            case -1:
                // openListing(listingId)
                openWatchedListings()
            break

            // unwatch button
            case 0:
                ApiCalls.ignore(listingId)
            break

            // bid button
            case 1:
                ApiCalls.bid(listingId, nextBid)
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
                openListing(listingId)
            break
        }
    }
}

// installation handler
chrome.runtime.onInstalled.addListener(async ({ reason, version }) => {
    if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
        playSound('yay')

        createNotification('INSTALLED', `Extension installed`, 'Yay!')
    }
})

// action message handler
chrome.runtime.onMessage.addListener((message, sender) => {
    console.log(message, sender?.tab?.id)

    if (message.action in actionHandlers) {
        actionHandlers[message.action](message.args, sender)
    }
})

// notification click handler
chrome.notifications.onClicked.addListener((id) => {
    const [ type, ...details ] = id.split('.')

    if (type in notificationHandlers) {
        notificationHandlers[type](-1, details)
    }
})

// notification button click handler
chrome.notifications.onButtonClicked.addListener((id, index) => {
    const [ type, ...details ] = id.split('.')

    if (type in notificationHandlers) {
        notificationHandlers[type](index, details)
    }
})

chrome.tabs.onUpdated.addListener(( updatedTabId, changeInfo, tab ) => {
    const commsTabId = data.watchedListingsTabIds[0]

    // if a watched listings tab has navigated elsewhere
    if (data.watchedListingsTabIds.includes(updatedTabId) && 'url' in changeInfo && changeInfo.url.includes('kotnauction.com/listings/watched') == false) {
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
                updateBadge('OK', 'green')
                console.log(`Enabling comms via tab ${data.watchedListingsTabIds[0]} due to tab ${commsTabId} navigating away`)
                chrome.tabs.sendMessage(data.watchedListingsTabIds[0], { action: 'ENABLE_COMMS' })
            } else {
                clearBadge()
                console.log('No tabs available for comms.')
            }
        }
    }
})

// tab closed handler
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
            updateBadge('OK', 'green')
            console.log(`Enabling comms via tab ${data.watchedListingsTabIds[0]} due to tab ${commsTabId} closing`)
            chrome.tabs.sendMessage(data.watchedListingsTabIds[0], { action: 'ENABLE_COMMS' })
        } else {
            clearBadge()
            console.log('No tabs available for comms.')
        }
    }
})

clearBadge()