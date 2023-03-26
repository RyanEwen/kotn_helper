const sounds = {
    beeps: new Audio(chrome.runtime.getURL('audio/beep.mp3')),
    yay: new Audio(chrome.runtime.getURL('audio/yay.mp3')),
}

const actions = {
    PLAY_SOUND: (sound) => {
        sounds[sound].play()
    },

    SHOW_ALERT: (text) => {
        alert(text)
    },
}

chrome.runtime.onMessage.addListener(message => {
    if (message.target !== 'OFFSCREEN') {
        return
    }

    if (message.type in actions) {
        return actions[message.type](message.data)
    } else {
        console.warn(`Unexpected message type received: '${message.type}'.`)
    }
})