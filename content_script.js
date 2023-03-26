console.log('KotN Helper - Watched Listings')

// listen for messages from inject.js
window.addEventListener('message', (event) => {
    if (event.data.from != 'KOTN_HELPER') {
        return
    }

    console.log('KotNHelper sending to service worker', {
        type: event.data.type,
        args: event.data.args,
    })

    chrome.runtime.sendMessage({
        target: 'SERVICE_WORKER',
        type: 'WEBSOCKET_MESSAGE',
        data: {
            type: event.data.type,
            args: event.data.args,
        },
    })
})

// create script tag that adds inject.js into the page
const script = document.createElement('script')
script.type = 'text/javascript'
script.src = chrome.runtime.getURL('inject.js')
document.getElementsByTagName('head')[0].appendChild(script)