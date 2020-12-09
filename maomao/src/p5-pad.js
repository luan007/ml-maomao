import * as shared from "./shared";
import * as planck from "planck-js"
import { eased, loop } from "./libao_stripped";

var world = shared.world;
var world_scaler = shared.world_scaler;

var updatables = [];
var w = 1920;
var h = 1080;
class pad_base {
    constructor(x, y, r, bag, render) {
        this.viz = eased(0, 1, 0.1, 0.00001);
        this.killed = false;
        this.hidden = false;
        this.body = world.createBody({
            type: 'static',
            position: planck.Vec2(x / world_scaler, y / world_scaler),
        });
        this.fix = this.body.createFixture({
            shape: planck.Circle(r / world_scaler)
        });
        this.fix.setRestitution(0.8);
        this.r = r;
        updatables.push(this);
        this.render = render || (() => { });
        this.bag = bag;
    }
    dead() {
        return this.viz.value == 0 && this.killed;
    }
    active() {
        return this.viz.to > 0;
    }
    show(sketch) {
        this.viz.to = this.killed ? 0 : 1;
        this.viz.to *= this.hidden ? 0 : 1;
        let viz = this.viz.value;
        if (this.dead()) {
            world.destroyBody(this.body);
            return;
        }
        this.body.setActive(this.active());
        sketch.push();
        sketch.noStroke();
        // sketch.fill(255);
        sketch.translate(this.body.getPosition().x * world_scaler, this.body.getPosition().y * world_scaler);
        // sketch.rotate(this.body.getAngle());
        // sketch.ellipse(0, 0, this.r * viz * 2, this.r * viz * 2);
        this.render(sketch, this.bag, this, this.r, viz);
        // sketch.image(shared.get_emoji_pimage(this.key), 0, 0, this.r * viz * 2, this.r * viz * 2);
        sketch.pop();
    }
}

function create_pad(x, y, r, bag, render) {
    return new pad_base(x, y, r, bag, render);
}

export function init_pads(sketch) {

}

export function update(sketch) {
    updatables = updatables.filter(v => {
        v.show(sketch);
        return !v.dead();
    });
}

var main_pad = create_pad(w / 4 * 3, h / 2, 250, {
    active: eased(0, 0, 0.05, 0.0001)
}, (sketch, bag, pad, r, viz) => {
    // var progress = shared.VPADS.EMOTION_SUPERHAPPY.hold_score_e.value;
    var progress = shared.VPADS.PD_HAND_OK.hold_score_e.value;
    // console.log(progress);
    // pad.hidden = !(shared.state_checks.tracked("paddlegesture", 100) && !shared.vue_computed.game_active())
    pad.hidden = !(shared.state_checks.tracked("paddlegesture", 100) && !shared.vue_computed.game_active())
    console.log(pad.hidden, !(shared.state_checks.tracked("paddlegesture", 100)), shared.vueData.game.state > 0, shared.vueData.game.state);
    if (pad.hidden) {
        shared.vueData.visual.large_note = "";
    } else {
        shared.vueData.visual.large_note = progress > 0.3 ? "很好，继续保持！" : "保持OK - 开启毛毛";
        // shared.vueData.visual.large_note = progress > 0.3 ? "很好，继续保持！" : "保持笑脸 - 开启毛毛";
    }

    if (viz < 0.1) return;
    var t = sketch.t;
    var rviz = r * viz * 2;

    bag.active.to = shared.VPADS.EMOTION_SUPERHAPPY.state ? 1 : 0;
    bag.active.to = shared.VPADS.PD_HAND_OK.state ? 1 : 0;
    // console.log(progress);
    sketch.fill(255);
    sketch.noStroke();
    sketch.ellipse(0, 0, rviz * bag.active, rviz * bag.active);

    sketch.fill(0x64, 0xe5, 0xb9, 255);
    sketch.noStroke();
    if (progress > 0) {
        sketch.arc(0, 0, rviz, rviz, 0, Math.PI * 2 * progress, sketch.PIE);
    }
    else if (progress == 1) {
        sketch.ellipse(0, 0, rviz, rviz);
    }
    sketch.noFill();
    sketch.stroke(0);
    sketch.strokeWeight(30);
    // sketch.fill(0x64, 0xe5, 0xb9, 255);
    sketch.ellipse(0, 0, rviz, rviz)
    sketch.push();
    sketch.rotate(viz * Math.PI * 2 + bag.active * + Math.cos(t * 5) * 0.09);
    var sviz = viz * viz + Math.sin(t * 5) * 0.1;
    sviz *= 0.8;
    sketch.scale(sviz, sviz);
    sketch.image(shared.emoji_pimages['👌'], 0, 0)
    sketch.pop();

    //TODO: bad practice
    if (progress == 1) {
        shared.start_game(-100);

        // console.log('start');
    }
})


//udlr

var grabbing = 0;
function build_emoji_pad(key, deg, rad, grab, icn) {
    var cx = icn ? (w / 2) : (w - w / 3.3);
    var cy = icn ? (h - 170) : (h / 2 + 30);
    create_pad(0, 0, grab ? 100 : 90, {
        active: eased(0, 0, 0.2, 0.0001),
        stablized: eased(0, 0, 0.2, 0.001)
    }, (sketch, bag, pad, r, viz) => {
        pad.body.setActive(false);
        var real_pad = shared.get_pad(key);

        var pressed = 0;
        if (real_pad) {
            if (!grab) {
                real_pad.bypass = grabbing > 0;
            } else {
                grabbing = real_pad.hold_score_e.value;
            }
        }

        if (real_pad && shared.vue_computed.game_stage_active()) {
            pressed = real_pad.triggered ? 1 : 0;
        }
        bag.active.to = pressed;



        var rotating = (1 - shared.shuffle_roller.value);
        if (rotating > 0.1) {
            bag.stablized.value = 1;
        }


        pad.hidden = !real_pad || !shared.vue_computed.game_is_running();
        var rviz = r * viz * 2;
        if (rviz < 3 || !real_pad) {
            shared.vueData.cmd[key] = 0;
            return;
        }
        sketch.push();
        sketch.translate(cx, cy);
        var rd = deg;
        if (!grab) {
            rd = deg + (1 - shared.shuffle_roller.value) * Math.PI * 10;
        }
        var x = Math.cos(rd) * rad;
        var y = Math.sin(rd) * rad;

        if (!grab && !icn) {
            sketch.push();
            sketch.rotate(rd);
            sketch.translate(0, 30 + shared.shuffle_roller.value * 13);
            sketch.fill(0);
            sketch.scale(3 * (shared.shuffle_roller.value));
            sketch.beginShape();
            sketch.vertex(0, 7);
            sketch.vertex(-7, 0);
            sketch.vertex(7, 0);
            sketch.endShape(sketch.CLOSE);
            sketch.pop();
        }


        sketch.translate(x, y);

        sketch.fill(0, 150);
        sketch.noStroke();
        sketch.ellipse(0, 30, rviz, rviz);

        sketch.push();
        var blink = (0.5 + Math.sin(sketch.t * 8) * 0.5) * 100 + 155;
        if (!grab) {
            sketch.translate(-rviz / 2, - rviz / 2);
            sketch.rotate(-Math.PI / 4)
            sketch.textAlign(sketch.CENTER, sketch.CENTER);
            sketch.textStyle(sketch.BOLD);
            sketch.textSize(35);
            // sketch.fill(0, 30);
            sketch.textStyle(sketch.BOLD);
            // sketch.text(real_pad.desc, 0, 8);
            sketch.fill(0, blink);
            sketch.text(real_pad.desc, 0, 0);
        } else {
            sketch.translate(0, -40 - rviz / 2);
            sketch.textAlign(sketch.CENTER, sketch.CENTER);
            sketch.textSize(35);
            sketch.fill(0, blink);
            sketch.textStyle(sketch.BOLD);
            sketch.text("下爪", 0, 8);
            // sketch.text("保持" + real_pad.desc + "下爪", 0, 8);
        }
        sketch.pop();

        sketch.fill(255 * (1 - bag.active.value));
        sketch.stroke(0);
        sketch.strokeWeight(10);
        sketch.translate(0, 30 * bag.active.value);
        sketch.ellipse(0, 0, rviz, rviz);

        if (grab && grabbing > 0) {
            sketch.fill(30, 255, 120);
            sketch.noStroke();
            sketch.arc(0, 0, rviz * 0.8, rviz * 0.8, 0, Math.PI * 2 * grabbing, sketch.PIE);

            //TODO: THIS IS REALLY BAD
            if (grabbing == 1) {
                shared.end_game(-100);
            }
            shared.vueData.cmd.g = grabbing == 1 ? 1 : 0;
        }
        else {
            shared.vueData.cmd[key] = pressed ? 1 : 0;
        }


        sketch.image(shared.emoji_pimages[real_pad.emoji], 0, 0, rviz * 0.8, rviz * 0.8)

        if (icn) {
            sketch.image(shared.emoji_pimages[icn], 0, -rviz * 1, rviz * 0.8, rviz * 0.8)
        }

        sketch.pop();


    });
}


build_emoji_pad("u", Math.PI / 2 + Math.PI, 200);
build_emoji_pad("d", Math.PI / 2, 200);
build_emoji_pad("l", Math.PI * 1, 200);
build_emoji_pad("r", 0, 200);
build_emoji_pad("g", Math.PI * 2 + Math.PI / 4 * 1, 400, true);



// build_emoji_pad("u", Math.PI * 1, 135, false, '*U-B');
// build_emoji_pad("d", 0, 135, false, '*D-B');
// build_emoji_pad("l", Math.PI * 1, 400, false, '*L-B');
// build_emoji_pad("r", 0, 400, false, '*R-B');
// build_emoji_pad("g", Math.PI * 2 + Math.PI / 4 * 1, 400, true);