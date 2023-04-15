const sounds = {
    beeps: new Audio(chrome.runtime.getURL('audio/beep.mp3')),
    yay: new Audio(chrome.runtime.getURL('audio/yay.mp3')),
}

// extension message handlers
const messageHandlers = {
    PLAY_SOUND: async (sound) => {
        sounds[sound].play()
    },
}

// listen for extension messages
chrome.runtime.onMessage.addListener((message, sender, respond) => {
    console.log(message, sender?.tab?.id)

    if (message.action in messageHandlers) {
        messageHandlers[message.action](message.args, sender).then((response) => {
            if (response) {
                respond(response)
            }
        })
    }
})
