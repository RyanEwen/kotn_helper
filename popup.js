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

// listen for link click
document.querySelector('#watched_listings_link').addEventListener('click', () => {
    chrome.runtime.sendMessage({
        target: 'ServiceWorker',
        type: 'PopupMessage',
        data: {
            action: 'showWatchedListings',
            args: {},
        },
    })
})
