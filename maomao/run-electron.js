// const appexp = require('express')();
// const server = require('http').Server(appexp);
// const io = require('socket.io')(server);
// appexp.use(require("cors")());
// appexp.use(require('serve-static')(__dirname));
// // server.listen(8000);

var electron = require('electron');
const { app, BrowserWindow, systemPreferences } = require('electron')

function createWindow() {
    // Create the browser window.
    let capture = new BrowserWindow({
        width: 1920,
        height: 1080,
        title: "VISION CAP"
    })
    // capture.loadURL('http://localhost:8000/#' + process.argv[2])
    capture.loadURL('http://localhost:8080/index.html')

    // let runnder = new BrowserWindow({
    //     width: 640,
    //     height: 480
    // })
    // runnder.loadURL('http://localhost:8000/#face')
}

app.commandLine.appendSwitch('--disable-http-cache')
app.whenReady().then(createWindow)