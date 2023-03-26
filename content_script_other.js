console.log('KotN Helper - Other')

// create style tag that adds inject.css into the page
const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = chrome.runtime.getURL('inject.css')
document.getElementsByTagName('head')[0].appendChild(link)