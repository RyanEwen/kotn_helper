console.log('KotN Helper - Watched Listings')

// create style tag that adds inject_watched.css into the page
const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = chrome.runtime.getURL('inject_watched.css')
document.getElementsByTagName('head')[0].appendChild(link)

const actionHandlers = {
    'ENABLE_COMMS': (args) => {
        // listen for postMessages from inject_watched.js
        window.addEventListener('message', (event) => {
            if (event.data.from != 'WATCHED_LISTINGS_INJECT_SCRIPT') {
                return
            }

            chrome.runtime.sendMessage(event.data.message)
        })

        // send a keepalive to the service worker as long as this page is open
        setInterval(() => {
            chrome.runtime.sendMessage({ action: 'KEEPALIVE' })
        }, 30000)

        // create script tag that adds inject_watched.js into the page
        const script = document.createElement('script')
        script.type = 'text/javascript'
        script.src = chrome.runtime.getURL('inject_watched.js')
        document.getElementsByTagName('head')[0].appendChild(script)

        console.log('KotN Helper - Comms enabled via this tab')
    },
}

// action message handler
chrome.runtime.onMessage.addListener((message) => {
    if (message.action in actionHandlers) {
        return actionHandlers[message.action](message.args)
    }
})

// tell the service worker that this tab is ready
chrome.runtime.sendMessage({ action: 'WATCHED_LISTINGS_OPENED' })
