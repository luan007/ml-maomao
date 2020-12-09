import * as planck from "planck-js"
import * as shared from "./shared";
import { pick, t } from "./libao_stripped";

var world = shared.world;
var stuff = [];
var world_scaler = shared.world_scaler;
var w = 1920 / world_scaler;
var h = 1080 / world_scaler;
var W = 1920;
var H = 1080;

class emoji_ball {
    constructor(x, y, r, vx, vy, key, bubble_mode) {
        var bubble = bubble_mode || 0;
        this.bubble_mode = bubble;
        this.kind = 1 + (bubble ? 1 : 0); //Math.random() > 0.5 ? 1 : 0;
        if (this.kind == 0) {
            r = 50;
        }

        this.key = key;
        if (this.kind == 2) {
            this.realKey = this.key.substring(0, this.key.length - 1);
        }
        this.life = 1;
        this.vlife = Math.random() * 0.01 + 0.001;

        this.body = world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearVelocity: planck.Vec2(vx, vy),
        });
        //bubble
        bubble_mode && this.body.setGravityScale(0.01);
        this.body.setMassData({
            mass: 2,
            center: planck.Vec2(),
            I: 0.5
        })
        this.flip_speed = Math.random() + 0.01;
        this.flip_count = 0;
        this.fix = this.body.createFixture({
            shape: planck.Circle(r / world_scaler)
        });
        this.fix.setRestitution(0.7);
        this.body.applyAngularImpulse((Math.random() > 0.5 ? 1 : -1) * (0.1 + Math.abs(Math.random() - 0.5)));
        this.r = r;
        stuff.push(this);
    }
    out_of_bound() {
        var x = this.body.getPosition().x * world_scaler;
        var y = this.body.getPosition().y * world_scaler;
        var r = this.r;
        return (x + r < 0 || /*y + r < 0||*/
            x - r > W || y - r > H);
    }
    dead() {
        return this.life < 0 || this.out_of_bound();
    }
    show(sketch) {
        this.bubble_mode && this.body.setGravityScale(shared.vueData.visual.bubble_burst ? 1 : 0.01);
        this.flip_count += 0.05 + this.flip_speed * 0.001;
        this.flip = Math.floor(this.flip_count % 2) + 1;

        this.life -= this.vlife;
        if (this.dead()) {
            world.destroyBody(this.body);
            return;
        }
        var viz = 1 - Math.pow(this.life * 2 - 1, 50);
        sketch.push();
        if (this.kind == 1) {
            sketch.fill(0x87, 0xe2, 0xbc, 55);
            // sketch.stroke(0x87, 0xe2, 0xbc);
        } else if (this.kind == 2) {
            sketch.fill(0, 0, 0, 0);
        } else {
            sketch.fill(255);
            // sketch.stroke(0);
        }
        // sketch.strokeWeight(10);
        sketch.noStroke();
        sketch.translate(this.body.getPosition().x * world_scaler, this.body.getPosition().y * world_scaler);
        sketch.rotate(this.body.getAngle());
        sketch.ellipse(0, 0, this.r * viz * 2, this.r * viz * 2);
        if (this.kind == 2) {
            sketch.image(shared.get_emoji_pimage(this.realKey + this.flip), 0, 0, this.r * viz * 2.6, this.r * viz * 2.6);
        } else {
            sketch.image(shared.get_emoji_pimage(this.key), 0, 0, this.r * viz * 2, this.r * viz * 2);
        }
        sketch.pop();
    }
}

var gate;
var crush_ball;

export function setup_world(sketch) {
    var ground = world.createBody({
        type: 'static',
        position: planck.Vec2(w / 2, h),
    });
    ground.createFixture(planck.Edge(planck.Vec2(-w / 2.0, -h), planck.Vec2(-w / 2, 0.0)));
    ground.createFixture(planck.Edge(planck.Vec2(w / 2.0, -h), planck.Vec2(w / 2, 0.0)));
    gate = world.createBody({
        type: 'static',
        position: planck.Vec2(w / 2, h),
    });
    gate.createFixture(planck.Edge(planck.Vec2(-w / 2.0, 0.0), planck.Vec2(w / 2, 0.0)));

    crush_ball = world.createBody({
        type: 'static',
        position: planck.Vec2(w / 2, h / 4 * 3)
    });
    crush_ball.createFixture(planck.Circle(0.6));
}


export function update(sketch) {
    world.step(1 / 60);
    if (stuff.length < shared.vueData.visual.ball_emitting) {
        // var q = new emoji_ball(Math.random() * w, 0, 60 + Math.random() * 100,
        //     pick(shared.emoji_keys)
        // );
        if (shared.vueData.visual.ball_mode == 'jet') {
            new emoji_ball(w / 2, h / 4, 60 + Math.random() * 100,
                (Math.random() - 0.5) * 7, -(Math.random() - 0.5) * 5 - 2,
                pick(shared.emoji_safe_keys)
            );
        } else if (shared.vueData.visual.ball_mode == 'waterfall') {
            new emoji_ball(Math.random() * w, 0, 60 + Math.random() * 100,
                (Math.random() - 0.5) * 7, 0,
                pick(shared.emoji_safe_keys)
            );
            new emoji_ball(w / 2, h / 4, 60 + Math.random() * 100,
                (Math.random() - 0.5) * 14, -(Math.random() - 0.5) * 15 - 2,
                pick(shared.emoji_safe_keys)
            );
            new emoji_ball(w / 2, h / 4, 60 + Math.random() * 100,
                (Math.random() - 0.5) * 14, -(Math.random() - 0.5) * 15 - 2,
                pick(shared.emoji_safe_keys)
            );
        }
        else if (shared.vueData.visual.ball_mode == 'soap') {
            new emoji_ball(Math.random() * w, Math.random() * h, 60 + Math.random() * 100,
                (Math.random() - 0.5) * 7, 0,
                pick(shared.emoji_maomao_keys), true
            );
            // new emoji_ball(w / 2, h / 4, 60 + Math.random() * 100,
            //     (Math.random() - 0.5) * 14, -(Math.random() - 0.5) * 15 - 2,
            //     pick(shared.emoji_keys)
            // );
            // new emoji_ball(w / 2, h / 4, 60 + Math.random() * 100,
            //     (Math.random() - 0.5) * 14, -(Math.random() - 0.5) * 15 - 2,
            //     pick(shared.emoji_keys)
            // );
        }
    }
    gate.setActive(shared.vueData.visual.ball_gate);
    stuff.forEach(v => {
        if (shared.vueData.visual.ball_emitting == -1) {
            v.vlife = 0.005;
        }
        v.show(sketch);
    });
    stuff = stuff.filter((v) => {
        return !v.dead();
    })

    crush_ball.setActive(shared.vueData.visual.crush_ball);
    if (shared.vueData.game.state == 0) {
        shared.vueData.visual.ball_mode = 'soap';
        shared.vueData.visual.ball_emitting = 50;
        shared.vueData.visual.ball_gate = false;
        shared.vueData.visual.bubble_burst = 0;
        if (shared.state_checks.tracked('face')) {
            // shared.vueData.visual.ball_emitting = -1;
            // shared.vueData.visual.bubble_burst = 1;
            shared.vueData.visual.ball_emitting = 30;
            shared.vueData.visual.bubble_burst = 0;
            shared.vueData.visual.ball_gate = false;
        }
    }
    else if (shared.vueData.game.state == 1 && shared.vueData.game.prep_countdown > 3) {
        shared.vueData.visual.ball_mode = 'waterfall';
        shared.vueData.visual.ball_emitting = 50;
        shared.vueData.visual.ball_gate = false;
        shared.vueData.visual.bubble_burst = 1;
    }
    else {
        shared.vueData.visual.ball_emitting = 0;
        shared.vueData.visual.ball_gate = 0;
        shared.vueData.visual.crush_ball = false;
    }
}
