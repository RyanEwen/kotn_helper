console.log('KotN Helper - Watched Listings')

// listen for messages from inject.js
window.addEventListener('message', (event) => {
    if (event.data.from != 'KotNHelper') {
        return
    }

    console.log('KotNHelper sending to service worker', event.data)
    chrome.runtime.sendMessage({ target: 'ServiceWorker', type: 'WebsocketMessage', data: event.data })
})

// create script tag that adds inject.js into the page
const script = document.createElement('script')
script.type = 'text/javascript'
script.src = chrome.runtime.getURL('inject.js')
document.getElementsByTagName('head')[0].appendChild(script)