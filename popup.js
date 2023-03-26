const inputEls = document.querySelectorAll('*[data-option_key]')

// populate with stored values
inputEls.forEach(async inputEl => {
    const storedData = await chrome.storage.sync.get(inputEl.dataset.option_key)

    // get saved value if exists
    if (storedData[inputEl.dataset.option_key]) {
        inputEl.value = storedData[inputEl.dataset.option_key]
    }
})

// listen for option changes
document.addEventListener('input', async event => {
    const inputEl = event.target

    await chrome.storage.sync.set({
        [inputEl.dataset.option_key]: inputEl.value
    })
})

// TODO open watched listings existing tab if avail