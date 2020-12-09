import p5 from "p5";
import io from "socket.io-client";
var VID_W = 640;
var VID_H = 480;

var client = io(":8001/capture");

const _root = (sketch) => {

    var video;
    var vid_canvas;

    var img = new Image();
    var img_p5;

    function setup() {
        sketch.createCanvas(640, 480);
        sketch.pixelDensity(1);
        video = sketch.createCapture(sketch.VIDEO);
        video.size(VID_W, VID_H);
        img_p5 = sketch.createImage(VID_W, VID_H);
        vid_canvas = sketch.createGraphics(video.width, video.height);
        vid_canvas.canvas.attributes.height.value = video.height;
        vid_canvas.canvas.attributes.width.value = video.width;
        video.hide();
        sketch.imageMode(sketch.CENTER);
        img.onload = function () {
            img_p5.drawingContext.drawImage(img, 0, 0);
        }
    }

    function send() {
        window.canvas = vid_canvas.canvas;
        var dataURL = vid_canvas.canvas.toDataURL("image/jpeg", 0.7);
        img.src = dataURL;
        client.emit("video", { data: dataURL });
    }

    var busy = false;
    function sendBlob() {
        if(busy) return;
        busy = true;
        var dataURL = vid_canvas.canvas.toBlob((blob) => {
            busy = false;
            client.emit("video-blob", blob);
        }, "image/jpeg", 0.5);
    }

    var i = 0;
    function draw() {
        sketch.background(0x66, 0x7e, 0xff);
        vid_canvas.image(video, 0, 0);
        sketch.image(vid_canvas, sketch.width / 2, sketch.height / 2);
        true && send();
        i = i > 100 ? 0 : i;
    }

    sketch.draw = draw;
    sketch.setup = setup;
}

var _myp5 = new p5(_root);
