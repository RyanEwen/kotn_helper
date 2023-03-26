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

// listen for test notification link click
document.querySelector('#send_test_notification').addEventListener('click', () => {
    chrome.runtime.sendMessage({
        target: 'SERVICE_WORKER',
        type: 'POPUP_MESSAGE',
        data: {
            action: 'TEST_NOTIFICATION',
        },
    })
})
