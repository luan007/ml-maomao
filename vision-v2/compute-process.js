var electron = require('electron');
const { app, BrowserWindow, systemPreferences } = require('electron')

function createWindow() {
    let runnder = new BrowserWindow({
        width: 320,
        backgroundThrottling: false,
        webPreferences: {
            webSecurity: false,
            allowRunningInsecureContent: true,
            backgroundThrottling: false,
        },
        height: 240
    })
    runnder.loadURL('http://localhost:8001/compute.html#face:pose:hand')
}

// app.commandLine.appendSwitch('--disable-http-cache')
systemPreferences.askForMediaAccess("camera")
// systemPreferences.askForMediaAccess("microphone")
app.whenReady().then(createWindow)