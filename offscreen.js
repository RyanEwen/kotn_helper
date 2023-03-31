const sounds = {
    beeps: new Audio(chrome.runtime.getURL('audio/beep.mp3')),
    yay: new Audio(chrome.runtime.getURL('audio/yay.mp3')),
}

const actionHandlers = {
    PLAY_SOUND: (sound) => {
        sounds[sound].play()
    },

    SHOW_ALERT: (text) => {
        alert(text)
    },
}

chrome.runtime.onMessage.addListener(message => {
    if (message.action in actionHandlers) {
        return actionHandlers[message.action](message.args)
    }
})