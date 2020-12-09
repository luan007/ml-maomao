const appexp = require('express')();
const server = require('http').Server(appexp);
const io = require('socket.io')(server);
appexp.use(require("cors")());

const user = io
    .of("/user").on("connection", (socket) => {
        socket.on("ctrl", (d) => {
            machine.emit("ctrl", d)
        });
        socket.on("req", (d) => {
            machine.emit("req", d)
        });
        socket.on("reboot", (d) => {

            require("child_process").execFileSync("reboot.bat")
            
            machine.emit("reboot", d);
            compute.emit("reboot", d);
        });
    });

const machine = io
    .of("/machine").on("connection", (socket) => {
        socket.on("state", (d) => {
            capture.emit("machine", d);
            user.emit("machine", d);
        });
    });

const compute = io
    .of("/compute")
    .on('connection', (socket) => {
        socket.on("sense", (d) => {
            capture.emit("sense", d);
            user.emit("sense", d);
        });
    });


const capture = io
    .of('/capture')
    .on('connection', (socket) => {
        console.log("capture device connected")
        socket.on("video", (vid) => {
            compute.emit("video", vid);
            user.emit("video", vid);
        })
        socket.on("video-blob", (vid) => {
            compute.emit("video-blob", vid);
            user.emit("video-blob", vid);
        })
        socket.on("ctrl", (d) => {
            machine.emit("ctrl", d)
        });
        socket.on("req", (d) => {
            machine.emit("req", d)
        });
    });

appexp.use(require('serve-static')(__dirname + "/dist"));
appexp.use(require('serve-static')(__dirname));
server.listen(8001);

var electron = require('electron');
const { app, BrowserWindow, systemPreferences } = require('electron')

function createWindow() {
    // Create the browser window.
    let capture = new BrowserWindow({
        width: 320,
        height: 240,
        webPreferences: {
            webSecurity: false,
            nodeIntegration: true,
            allowRunningInsecureContent: true,
            backgroundThrottling: false,
        },
        title: "Capture"
    })
    capture.loadURL('http://localhost:8001/capture.html')

    // var v = ["face", "hand", "pose"];
    // v.forEach(v => {
    //     let runnder = new BrowserWindow({
    //         width: 320,
    //         backgroundThrottling: false,
    //         height: 240
    //     })
    //     runnder.loadURL('http://localhost:8000/compute.html#' + v)
    // })

    let runnder = new BrowserWindow({
        width: 320,
        backgroundThrottling: false,
        nodeIntegration: true,
        webPreferences: {
            webSecurity: false,
            nodeIntegration: true,
            allowRunningInsecureContent: true,
            backgroundThrottling: false,
        },
        height: 240
    })
    runnder.loadURL('http://localhost:8001/compute.html#paddlegesture')
}

// app.commandLine.appendSwitch('--disable-http-cache')
systemPreferences.askForMediaAccess("camera")
// systemPreferences.askForMediaAccess("microphone")
app.whenReady().then(createWindow)