import * as shared from "./shared";
import p5 from "p5";
import { eased, loop } from "./libao_stripped";
import * as balls from "./p5-balls";
import * as pads from "./p5-pad";

var t = 0;
var wc = 1920 / 2;
var hc = 1080 / 2;
var h = 1080;
var w = 1920;
window.track_test = undefined;
//puppet p5 instance
var img_p5;

class TrackedFace {
    constructor(instance, sz) {
        this.sz = sz;
        this.antialias = 5;
        this.instance = instance;
        this.offset = 0;
        this.mask = instance.createGraphics(sz, sz);
        this.graphics = instance.createGraphics(sz, sz);
        this.offset_pos = {
            x: eased(0, 0, 0.1, 0.00001),
            y: eased(0, 0, 0.1, 0.00001)
        };
        this.pos = {
            x: eased(0, 0, 0.1, 0.00001),
            y: eased(0, 0, 0.1, 0.00001),
            scaler: eased(1, 1, 0.1, 0.00001),
            tracked: eased(0, 0, 0.1, 0.0001),
            main_scale: eased(0, 0, 0.1, 0.00001)
        };
        this.viz = eased(0, 1, 0.1, 0.0001);
    }
    drawMask() {
        this.mask.clear();
        this.mask.ellipseMode(this.instance.CENTER);
        this.mask.background(0);
        this.mask.blendMode(this.instance.REMOVE);
        this.mask.noStroke();
        this.mask.fill(255);
        this.mask.ellipse(0, 0, this.sz - this.antialias, this.sz - this.antialias);
    }
    drawContent() {
        if (shared.state_checks.tracked("face")) {
            var face_area = shared.data.sensed.face.detection._box;
            var cx = face_area._x + face_area._width / 2;
            var cy = face_area._y + face_area._height / 2;
            var fw = face_area._width;
            var fh = face_area._height;
            var d = Math.max(fw, fh);
            this.pos.scaler.to = this.sz / d * 0.8;
            this.pos.x.to = -cx + 640 / 2;
            this.pos.y.to = -cy + 480 / 2;
            this.pos.main_scale.to = 1;
            this.pos.tracked.to = 1;
        }
        else {
            this.pos.scaler.to = 1;
            this.pos.x.to = 0;
            this.pos.y.to = 0;
            this.pos.main_scale.to = 0.8;
            this.pos.tracked.to = 0;
        }

        this.graphics.background(30, 200, 255);
        this.graphics.push();
        this.graphics.translate(-this.sz / 2, -this.sz / 2);
        this.graphics.strokeWeight(10);
        this.graphics.stroke(0);
        this.offset += 1;
        for (var x = 0; x <= this.sz; x += 50) {
            var _x = x + this.offset;
            _x = _x % this.sz;
            this.graphics.line(_x, 0, 0, _x);
            _x = this.sz - _x;
            this.graphics.line(this.sz, this.sz - _x, this.sz - _x, this.sz);
        }
        this.graphics.noStroke();
        this.graphics.pop();
        this.graphics.ellipseMode(this.instance.CENTER);
        this.graphics.blendMode(this.instance.BLEND);
        this.graphics.imageMode(this.instance.CENTER);
        this.graphics.push();
        this.graphics.scale(this.pos.scaler.value);
        this.graphics.translate(this.pos.x.value, this.pos.y.value);
        this.graphics.image(img_p5, 0, 0);
        this.graphics.pop();
        this.graphics.blendMode(this.instance.REMOVE);
        this.graphics.image(this.mask, 0, 0);
    }
    draw() {
        if (!(this.viz.to > 0 && this.viz.value > 0.1)) {
            return;
        }
        this.graphics.push();
        this.mask.push();
        this.graphics.translate(this.sz / 2, this.sz / 2);
        this.mask.translate(this.sz / 2, this.sz / 2);
        this.drawMask();
        this.drawContent();
        this.graphics.pop();
        this.mask.pop();
        this.instance.imageMode(this.instance.CENTER);
        this.instance.push();
        this.instance.translate(this.offset_pos.x.value, this.offset_pos.y.value);
        this.instance.scale(this.pos.main_scale.value * this.viz.value);
        var blink = Math.sin(t) * 0.5 + 0.5;
        this.instance.noStroke();

        for (var i = 0; i < 5; i++) {
            var s = this.sz + i * 50 * this.pos.tracked.value *
                (Math.sin(i / 5 + t / 3) * 0.2 + 0.8);
            this.instance.fill(255, 30);
            this.instance.ellipse(0, 0, s, s);
        }


        this.pos.main_scale.to = track_test != undefined ? (track_test ? 1 : 0.7) : this.pos.main_scale.to;
        this.pos.tracked.to = track_test != undefined ? track_test :this.pos.tracked.to;

        this.instance.push();
        this.instance.fill(255 * this.pos.tracked.value);
        this.instance.rotate(Math.PI / 5);
        this.instance.translate(0, this.sz / 2 * (1 - this.pos.tracked.value));
        this.instance.rectMode(this.instance.CENTER);
        this.instance.rect(0, 15, 220, 110, 10);
        this.instance.fill(255, 120, 10, (Math.sin(t * 2) * 0.2 + 0.8) * 255 * (1 - this.pos.tracked.value));
        this.instance.noStroke();
        this.instance.textFont("PingFang HK");
        this.instance.textStyle(this.instance.BOLD)
        this.instance.textSize(25);
        this.instance.textAlign(this.instance.CENTER, this.instance.CENTER);
        // this.instance.text("[人脸] 无数据", 0, 35);
        this.instance.pop();


        this.instance.fill(0, (150 + 50 * blink) * this.pos.tracked.value, 100 * this.pos.tracked.value);
        this.instance.stroke(255, 255 * this.pos.tracked.value);
        this.instance.strokeWeight(15);
        this.instance.ellipse(0, 0, this.sz + 35, this.sz + 35);

        this.instance.image(this.graphics, 0, 0);
        this.instance.pop();
    }
}


class TrackedHand {
    constructor(instance, sz) {
        this.offset_pos = {
            x: eased(0, 0, 0.1, 0.00001),
            y: eased(0, 0, 0.1, 0.00001)
        };
        this.sz = sz;
        this.antialias = 5;
        this.instance = instance;
        this.offset = 0;
        this.mask = instance.createGraphics(sz, sz);
        this.graphics = instance.createGraphics(sz, sz);
        this.pos = {
            x: eased(0, 0, 0.1, 0.00001),
            y: eased(0, 0, 0.1, 0.00001),
            scaler: eased(1, 1, 0.1, 0.00001),
            tracked: eased(0, 0, 0.1, 0.0001),
            main_scale: eased(0, 0, 0.1, 0.00001)
        };
        this.viz = eased(0, 1, 0.1, 0.0001);
    }
    drawMask() {
        this.mask.clear();
        this.mask.ellipseMode(this.instance.CENTER);
        this.mask.background(0);
        this.mask.blendMode(this.instance.REMOVE);
        this.mask.noStroke();
        this.mask.fill(255);
        this.mask.ellipse(0, 0, this.sz - this.antialias, this.sz - this.antialias);
    }
    drawContent() {
        if (shared.state_checks.tracked("hand")) {
            var hand_area = shared.data.sensed.hand.hand.boundingBox;
            var cx = (hand_area.bottomRight[0] + hand_area.topLeft[0]) / 2
            var cy = (hand_area.bottomRight[1] + hand_area.topLeft[1]) / 2
            var fw = hand_area.bottomRight[0] - hand_area.topLeft[0];
            var fh = hand_area.bottomRight[1] - hand_area.topLeft[1];
            var d = Math.max(fw, fh);
            this.pos.scaler.to = 1; //this.sz / d * 1.3;
            this.pos.x.to = -cx + 640 / 2;
            this.pos.y.to = -cy + 480 / 2;
            this.pos.main_scale.to = 1;
            this.pos.tracked.to = 1;
        }
        else {
            this.pos.scaler.to = 1;
            this.pos.x.to = 0;
            this.pos.y.to = 0;
            this.pos.main_scale.to = 0.7;
            this.pos.tracked.to = 0;
        }
        this.graphics.imageMode(this.instance.CENTER);
        this.graphics.background(255, 100, 30);
        this.graphics.push();
        this.graphics.translate(-this.sz / 2, -this.sz / 2);
        this.graphics.strokeWeight(10);
        this.graphics.stroke(0);
        this.offset += 1;
        for (var x = 0; x <= this.sz; x += 50) {
            var _x = x + this.offset;
            _x = _x % this.sz;
            this.graphics.line(_x, 0, 0, _x);
            _x = this.sz - _x;
            this.graphics.line(this.sz, this.sz - _x, this.sz - _x, this.sz);
        }
        this.graphics.noStroke();
        this.graphics.pop();
        this.graphics.ellipseMode(this.instance.CENTER);
        this.graphics.blendMode(this.instance.BLEND);
        this.graphics.imageMode(this.instance.CENTER);
        this.graphics.push();
        this.graphics.scale(this.pos.scaler.value);
        this.graphics.translate(this.pos.x.value, this.pos.y.value);
        this.graphics.image(img_p5, 0, 0);
        this.graphics.blendMode(this.graphics.ADD);
        if (shared.state_checks.tracked("hand")) {
            var landmarks = shared.data.sensed.hand.hand.landmarks;
            for (var i = 0; i < landmarks.length; i++) {
                this.graphics.fill(100, 180, 255);
                this.graphics.noStroke();
                var turnSS = (Math.sin(t + i / landmarks.length * Math.PI * 2) * 0.3 + 0.7) * 20 * this.pos.tracked.value;
                this.graphics.ellipse(
                    shared.sensed_eased_patch.hand_x_y[i][0] - 640 / 2, shared.sensed_eased_patch.hand_x_y[i][1] - 480 / 2,
                    turnSS,
                    turnSS);
            }
        }
        this.graphics.blendMode(this.graphics.BLEND);
        this.graphics.pop();
        this.graphics.blendMode(this.instance.REMOVE);
        this.graphics.image(this.mask, 0, 0);
    }
    draw() {
        if (!(this.viz.to > 0 && this.viz.value > 0.1)) {
            return;
        }
        this.graphics.push();
        this.mask.push();
        this.graphics.translate(this.sz / 2, this.sz / 2);
        this.mask.translate(this.sz / 2, this.sz / 2);
        this.drawMask();
        this.drawContent();
        this.graphics.pop();
        this.mask.pop();
        this.instance.imageMode(this.instance.CENTER);
        this.instance.push();
        this.instance.translate(this.offset_pos.x.value, this.offset_pos.y.value);
        this.instance.scale(this.pos.main_scale.value * this.viz.value);
        var blink = Math.sin(t) * 0.5 + 0.5;

        this.instance.noStroke();

        for (var i = 0; i < 3; i++) {
            var s = this.sz + i * 50 * this.pos.tracked.value *
                (Math.sin(i / 2 + t / 3) * 0.2 + 0.8);
            this.instance.fill(255, 30);
            this.instance.ellipse(0, 0, s, s);
        }

        this.pos.main_scale.to = track_test != undefined ? (track_test ? 1 : 0.7) : this.pos.main_scale.to;
        this.pos.tracked.to = track_test != undefined ? track_test :this.pos.tracked.to;

        this.instance.push();
        this.instance.fill(255 * this.pos.tracked.value);
        this.instance.rotate(Math.PI / 5);
        this.instance.translate(0, this.sz / 2 * (1 - this.pos.tracked.value));
        this.instance.rectMode(this.instance.CENTER);
        this.instance.rect(0, 15, 220, 110, 10);
        this.instance.fill(255, 120, 10, (Math.sin(t * 2) * 0.2 + 0.8) * 255 * (1 - this.pos.tracked.value));
        this.instance.noStroke();
        this.instance.textFont("PingFang HK");
        this.instance.textStyle(this.instance.BOLD)
        this.instance.textSize(25);
        this.instance.textAlign(this.instance.CENTER, this.instance.CENTER);
        this.instance.text("[手势] 无数据", 0, 35);
        this.instance.pop();


        this.instance.fill(0, (150 + 50 * blink) * this.pos.tracked.value, 100 * this.pos.tracked.value);
        this.instance.stroke(255, 255 * this.pos.tracked.value);
        this.instance.strokeWeight(15);
        this.instance.ellipse(0, 0, this.sz + 35, this.sz + 35);



        this.instance.image(this.graphics, 0, 0);


        this.instance.pop();
    }
}


class TrackedBody {
    constructor(instance, sz) {
        this.offset_pos = {
            x: eased(0, 0, 0.1, 0.00001),
            y: eased(0, 0, 0.1, 0.00001)
        };
        this.sz = sz;
        this.antialias = 5;
        this.instance = instance;
        this.offset = 0;
        this.mask = instance.createGraphics(sz, sz);
        this.graphics = instance.createGraphics(sz, sz);
        this.pos = {
            x: eased(0, 0, 0.1, 0.00001),
            y: eased(0, 0, 0.1, 0.00001),
            scaler: eased(1, 1, 0.1, 0.00001),
            tracked: eased(0, 0, 0.1, 0.0001),
            main_scale: eased(0, 0, 0.1, 0.00001)
        };
        this.viz = eased(0, 1, 0.1, 0.0001);
    }
    drawMask() {
        this.mask.clear();
        this.mask.ellipseMode(this.instance.CENTER);
        this.mask.background(0);
        this.mask.blendMode(this.instance.REMOVE);
        this.mask.noStroke();
        this.mask.fill(255);
        this.mask.ellipse(0, 0, this.sz - this.antialias, this.sz - this.antialias);
    }
    drawContent() {
        if (shared.state_checks.tracked("pose")) {
            var body_area = shared.data.sensed.pose.rect;
            var cx = body_area.center.x;
            var cy = body_area.center.y;
            var fw = body_area.w;
            var fh = body_area.h;
            var d = Math.max(fw, fh);
            this.pos.scaler.to = this.sz / d * 0.8;
            // this.pos.x.to = -cx + 640 / 2;
            // this.pos.y.to = -cy + 480 / 2;
            this.pos.main_scale.to = 1;
            this.pos.tracked.to = 1;
        }
        else {
            this.pos.scaler.to = 1;
            this.pos.x.to = 0;
            this.pos.y.to = 0;
            this.pos.main_scale.to = 0.7;
            this.pos.tracked.to = 0;
        }

        //for debug purposes
        // if (true) {
        //     //30 - 30 - 100 - 100
        //     var cx = 30 + 100 / 2;
        //     var cy = 30 + 100 / 2;
        //     var fw = 100;
        //     var fh = 100;
        //     var d = Math.max(fw, fh);
        //     this.pos.scaler.to = 2;
        //     this.pos.x.to = -cx + 640 / 2;
        //     this.pos.y.to = -cy + 480 / 2;
        //     this.pos.main_scale.to = 1;
        //     this.pos.tracked.to = 1;
        // }



        this.graphics.imageMode(this.instance.CENTER);
        this.graphics.background(255, 200, 30);
        this.graphics.push();
        this.graphics.translate(-this.sz / 2, -this.sz / 2);
        this.graphics.strokeWeight(10);
        this.graphics.stroke(0);
        this.offset += 1;
        for (var x = 0; x <= this.sz; x += 50) {
            var _x = x + this.offset;
            _x = _x % this.sz;
            this.graphics.line(_x, 0, 0, _x);
            _x = this.sz - _x;
            this.graphics.line(this.sz, this.sz - _x, this.sz - _x, this.sz);
        }
        this.graphics.noStroke();
        this.graphics.pop();
        this.graphics.ellipseMode(this.instance.CENTER);
        this.graphics.blendMode(this.instance.BLEND);
        this.graphics.imageMode(this.instance.CENTER);
        this.graphics.push();
        this.graphics.scale(this.pos.scaler.value);
        this.graphics.translate(this.pos.x.value, this.pos.y.value);
        this.graphics.image(img_p5, 0, 0);
        this.graphics.blendMode(this.graphics.ADD);
        if (shared.state_checks.tracked("pose")) {
            var landmarks = shared.data.sensed.pose.keys;
            var q = 0;
            for (var i in landmarks) {
                q++;
                this.graphics.fill(255, 100, 10);
                this.graphics.noStroke();
                var turnSS = (Math.sin(t + q / 17 * Math.PI * 2) * 0.3 + 0.7) * 20 * this.pos.tracked.value;
                this.graphics.ellipse(
                    shared.sensed_eased_patch.pose_x_y[i][0] - 640 / 2, shared.sensed_eased_patch.pose_x_y[i][1] - 480 / 2,
                    turnSS,
                    turnSS);
            }
        }
        this.graphics.blendMode(this.graphics.BLEND);
        this.graphics.pop();
        this.graphics.blendMode(this.instance.REMOVE);
        this.graphics.image(this.mask, 0, 0);
    }
    draw() {
        if (!(this.viz.to > 0 && this.viz.value > 0.1)) {
            return;
        }
        this.graphics.push();
        this.mask.push();
        this.graphics.translate(this.sz / 2, this.sz / 2);
        this.mask.translate(this.sz / 2, this.sz / 2);
        this.drawMask();
        this.drawContent();
        this.graphics.pop();
        this.mask.pop();
        this.instance.imageMode(this.instance.CENTER);
        this.instance.push();
        this.instance.translate(this.offset_pos.x.value, this.offset_pos.y.value);
        this.instance.scale(this.pos.main_scale.value * this.viz.value);
        var blink = Math.sin(t) * 0.5 + 0.5;
        this.instance.noStroke();

        for (var i = 0; i < 3; i++) {
            var s = this.sz + i * 50 * this.pos.tracked.value *
                (Math.sin(i / 2 + t / 3) * 0.2 + 0.8);
            this.instance.fill(255, 30);
            this.instance.ellipse(0, 0, s, s);
        }


        this.pos.main_scale.to = track_test != undefined ? (track_test ? 1 : 0.7) : this.pos.main_scale.to;
        this.pos.tracked.to = track_test != undefined ? track_test :this.pos.tracked.to;
        
        this.instance.push();
        this.instance.fill(255 * this.pos.tracked.value);
        this.instance.rotate(Math.PI / 5);
        this.instance.translate(0, this.sz / 2 * (1 - this.pos.tracked.value));
        this.instance.rectMode(this.instance.CENTER);
        this.instance.rect(0, 15, 220, 110, 10);
        this.instance.fill(255, 120, 10, (Math.sin(t * 2) * 0.2 + 0.8) * 255 * (1 - this.pos.tracked.value));
        this.instance.noStroke();
        this.instance.textFont("PingFang HK");
        this.instance.textStyle(this.instance.BOLD)
        this.instance.textSize(25);
        this.instance.textAlign(this.instance.CENTER, this.instance.CENTER);
        this.instance.text("[体感] 无数据", 0, 35);
        this.instance.pop();


        this.instance.fill(0, (150 + 50 * blink) * this.pos.tracked.value, 100 * this.pos.tracked.value);
        this.instance.stroke(255, 255 * this.pos.tracked.value);
        this.instance.strokeWeight(15);
        this.instance.ellipse(0, 0, this.sz + 35, this.sz + 35);

        this.instance.image(this.graphics, 0, 0);
        this.instance.pop();
    }
}


const _root = (sketch) => {

    for (var i in shared.emoji_urls) {
        shared.emoji_pimages[i] = sketch.loadImage(shared.emoji_urls[i]);;
    }

    var face = new TrackedFace(sketch, 600);
    var body = new TrackedBody(sketch, 500);
    var hand = new TrackedHand(sketch, 300);
    sketch.t = 0;
    var offsetX = 0;
    var offsetY = 0;
    function render_cutebg() {
        var blocks = 120;
        offsetX += 1;
        offsetY += 1;
        sketch.noStroke();
        for (var x = -blocks; x < sketch.width + blocks; x += blocks) {
            for (var y = -blocks; y < sketch.height + blocks; y += blocks) {
                var rx = (x + offsetX) % (sketch.width + blocks * 2) - blocks;
                var ry = (y + offsetY) % (sketch.height + blocks * 2) - blocks;
                var sz = blocks * 0.5;
                sz *= ((Math.sin(t / 10 + rx / 1000) + Math.cos(t / 10 - ry / 1000)) * 0.5 + 0.5);
                //0, 0x86, 0xf9
                var col = 0.5 + 0.5 * (Math.sin(t * 2 - rx / 100) + Math.cos(t * 2 + ry / 100));
                sketch.fill(0xff, 0xff, 0xff, 30);
                sketch.ellipse(rx, ry, sz, sz);
            }
        }
    }

    function setup() {
        sketch.noLoop();
        sketch.createCanvas(1920, 1080);
        sketch.pixelDensity(1);
        // sketch.noLoop();
        sketch.canvas.remove();
        document.body.querySelector("#canvas_holder").appendChild(sketch.canvas)
        img_p5 = sketch.createImage(640, 480);
        shared.data.image.onload = function () {
            img_p5.drawingContext.drawImage(shared.data.image, 0, 0);
        }
        balls.setup_world(sketch);
        pads.init_pads(sketch);
        loop(() => {
            this.draw();
        });
    }

    function draw() {
        t += 0.1;
        sketch.t = t / 5;
        sketch.background(0x33, 0x55, 0xee);
        sketch.background(0x88, 0xaa, 0xee);
        sketch.background(0xff, 0xaa, 0x33);
        render_cutebg();
        sketch.imageMode(sketch.CENTER);
        balls.update(sketch);
        pads.update(sketch);
        sketch.push();
        body.viz.to = shared.data.visual.viz.body;
        hand.viz.to = shared.data.visual.viz.hand;
        face.viz.to = shared.data.visual.viz.face;


        body.offset_pos.x.to = shared.data.visual.pos.body[0];
        body.offset_pos.y.to = shared.data.visual.pos.body[1];
        hand.offset_pos.x.to = shared.data.visual.pos.hand[0];
        hand.offset_pos.y.to = shared.data.visual.pos.hand[1];
        face.offset_pos.x.to = shared.data.visual.pos.face[0];
        face.offset_pos.y.to = shared.data.visual.pos.face[1];
        body.draw();
        face.draw();
        hand.draw();
        window.face = face;
        sketch.pop();
    }

    sketch.draw = draw;
    sketch.setup = setup;
}
var _myp5 = new p5(_root);