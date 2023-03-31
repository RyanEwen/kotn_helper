console.log('KotN Helper - Auctions')

// listen for messages from inject_watched.js
window.addEventListener('message', (event) => {
    if (event.data.from != 'AUCTIONS') {
        return
    }

    chrome.runtime.sendMessage(event.data.message)
})

// create script tag that adds inject_auctions.js into the page
const script = document.createElement('script')
script.type = 'text/javascript'
script.src = chrome.runtime.getURL('inject_auctions.js')
document.getElementsByTagName('head')[0].appendChild(script)

// create style tag that adds inject_auctions.css into the page
const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = chrome.runtime.getURL('inject_auctions.css')
document.getElementsByTagName('head')[0].appendChild(link)