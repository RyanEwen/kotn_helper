const sounds = {
    beeps: new Audio(chrome.runtime.getURL('audio/beep.mp3')),
    yay: new Audio(chrome.runtime.getURL('audio/yay.mp3')),
}

// extension message handlers
const messageHandlers = {
    PLAY_SOUND: (sound) => {
        sounds[sound].play()
    },

    SHOW_ALERT: (text) => {
        alert(text)
    },
}

// listen for extension messages
chrome.runtime.onMessage.addListener(message => {
    if (message.action in messageHandlers) {
        messageHandlers[message.action](message.args)
    }
})
