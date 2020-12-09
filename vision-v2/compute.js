global.config = {
    socket: "http://localhost:8001/compute",
    models: "http://localhost:8001/models"
};

window._model_path_ = "http://localhost:8001"


import socketio from "socket.io-client";
import * as engine from "./detectors/*.js"
var io = socketio(config.socket);

var image_cache = new Image();

// document.body.appendChild(image_cache);
var canvas_dbg = document.createElement("canvas");
var canvas_dbg_ctx = canvas_dbg.getContext('2d')
document.body.appendChild(canvas_dbg);

var selected_engines;

function engine_init(opts) {
    selected_engines = {};
    console.log('Opts', opts);
    opts.forEach(v => {
        if (engine.default[v]) {
            selected_engines[v] = engine.default[v];
        }
    });

    var promises = [];
    for (var i in selected_engines) {
        console.log('Engine Init >', i)
        promises.push(selected_engines[i].init());
    }
    Promise.all(promises).then(() => {
        console.log("All loaded");

        io.on("video-blob", (vid) => {
            image_cache.src = URL.createObjectURL(new Blob([new Uint8Array(vid, 0, vid.length)]));
        });
        io.on("video", (vid) => {
            image_cache.src = vid.data;
        });
        console.log('Starting all engines')

        image_cache.onload = engine_new_frame;
    });
}

var overall_skipper = 0;

//frame arrived
function engine_new_frame() {
    overall_skipper++;
    canvas_dbg.height = image_cache.height;
    canvas_dbg.width = image_cache.width;
    canvas_dbg_ctx.drawImage(image_cache, 0, 0);
    if (overall_skipper < 60) {
        console.log("skip!");
        return;
    }

    for (var i in selected_engines) {
        ((i) => {
            selected_engines[i].detect(image_cache, (data) => {
                var d = {};
                d[i] = data;
                d[i] = d[i] || false;
                console.log(d);
                io.emit("sense", d);
            });
        })(i);
    }
    for (var i in selected_engines) {
        selected_engines[i].render(canvas_dbg_ctx);
    }
}

engine_init(
    window.location.hash.replace("#", "").split(":")
);