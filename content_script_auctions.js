console.log('KotN Helper - Auctions')

// create style tag that adds inject_auctions.css into the page
const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = chrome.runtime.getURL('inject_auctions.css')
document.getElementsByTagName('head')[0].appendChild(link)
