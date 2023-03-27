console.log('KotN Helper - Watched Listings')

// listen for messages from inject.js
window.addEventListener('message', (event) => {
    if (event.data.from != 'KOTN_HELPER') {
        return
    }

    chrome.runtime.sendMessage({
        target: 'SERVICE_WORKER',
        type: 'CONTENT_SCRIPT',
        data: {
            type: event.data.type,
            args: event.data.args,
        },
    })
})

setInterval(() => {
    chrome.runtime.sendMessage({
        target: 'SERVICE_WORKER',
        type: 'CONTENT_SCRIPT',
        data: {
            type: 'KEEPALIVE',
            args: {},
        },
    })
}, 30000)

// create script tag that adds inject.js into the page
const script = document.createElement('script')
script.type = 'text/javascript'
script.src = chrome.runtime.getURL('inject.js')
document.getElementsByTagName('head')[0].appendChild(script)

// create style tag that adds inject.css into the page
const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = chrome.runtime.getURL('inject.css')
document.getElementsByTagName('head')[0].appendChild(link)