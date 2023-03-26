// populate options with stored values
document.querySelectorAll('*[data-option_key]').forEach(async inputEl => {
    const storedData = await chrome.storage.sync.get(inputEl.dataset.option_key)

    // get saved value if exists
    if (storedData[inputEl.dataset.option_key]) {
        inputEl.value = storedData[inputEl.dataset.option_key]
    }
})

// listen for changes to options
document.addEventListener('input', async event => {
    const inputEl = event.target

    await chrome.storage.sync.set({
        [inputEl.dataset.option_key]: inputEl.value
    })
})

// listen for watched listings link click
document.querySelector('#watched_listings_link').addEventListener('click', () => {
    chrome.runtime.sendMessage({
        target: 'SERVICE_WORKER',
        type: 'POPUP_MESSAGE',
        data: {
            action: 'SHOW_WATCHED_LISTINGS',
        },
    })
})

// listen for test outbid notification link click
document.querySelector('#test_outbid_notification').addEventListener('click', () => {
    chrome.runtime.sendMessage({
        target: 'SERVICE_WORKER',
        type: 'POPUP_MESSAGE',
        data: {
            action: 'TEST_OUTBID_NOTIFICATION',
        },
    })
})

// listen for test item won notification link click
document.querySelector('#test_item_won_notification').addEventListener('click', () => {
    chrome.runtime.sendMessage({
        target: 'SERVICE_WORKER',
        type: 'POPUP_MESSAGE',
        data: {
            action: 'TEST_ITEM_WON_NOTIFICATION',
        },
    })
})
