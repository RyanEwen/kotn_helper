const sounds = {
    beeps: new Audio(chrome.runtime.getURL('audio/beep.mp3')),
    yay: new Audio(chrome.runtime.getURL('audio/yay.mp3')),
}

chrome.runtime.onMessage.addListener(message => {
    if (message.target !== 'offscreen') {
        return
    }

    switch (message.type) {
        case 'play-sound':
            sounds[message.data].play()
        break;

        case 'show-alert':
            alert(message.data)
        break;

        default:
            console.warn(`Unexpected message type received: '${message.type}'.`)
    }
})