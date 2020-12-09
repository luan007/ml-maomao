import * as planck from "planck-js"
import io from "socket.io-client";
import { shuffleArray, looperStart, loop, ease, eased, clamp, pick } from "./libao_stripped";
import * as emoji_list from "./emoji.json";

window.OFFLINE_DEBUG = 1;
export var emoji_urls = {};
Object.keys(emoji_list).forEach(i => {
    if (i == 'default') return;
    emoji_urls[i] = "img/" + emoji_list[i] + ".png";
});
export var shuffle_roller = eased(0, 1, 0.05, 0.00001);
export var emoji_keys = Object.keys(emoji_urls);
export var emoji_safe_keys = Object.keys(emoji_urls).filter(n => n.indexOf("*") == -1 && n.indexOf("@") == -1);
export var emoji_maomao_keys = Object.keys(emoji_urls).filter(n => n.indexOf("@") !== -1);
export var emoji_pimages = {};

export var get_emoji_pimage = function (key) {
    return emoji_pimages[key];
}

export var get_emoji_url = function (key) {
    return emoji_urls[key];
}


const STATE_NO_UPDATE_THRESHOLD = 2000; //ms

export var world = planck.World({
    gravity: planck.Vec2(0, 10.2) //moon
    // gravity: planck.Vec2(0, .1)
});
export var world_scaler = 500;

export var data = {
    video_src: "",
    image: new Image(),
    sensed: {},
    tracked: {},
    computed: {
        paddlegesture: {
            gesture: ""
        },
        hand: {
            gesture: "",
            direction: ""
        },
        pose: {
            kind: ""
        },
        face: {
            LR_VAL: 0,
            LR: eased(0, 0, 0.2, 0.00001),
            TD_VAL: 0,
            TD: eased(0, 0, 0.2, 0.00001),
            MOUTH: 0,
            MOUTH_E: eased(0, 0, 0.2, 0.00001),
            emotions: {
                neutral: eased(0, 0, 0.2, 0.00001),
                happy: eased(0, 0, 0.2, 0.00001),
                sad: eased(0, 0, 0.2, 0.00001),
                angry: eased(0, 0, 0.2, 0.00001),
                fearful: eased(0, 0, 0.2, 0.00001),
                disgusted: eased(0, 0, 0.2, 0.00001),
                surprised: eased(0, 0, 0.2, 0.00001)
            }
        }
    },
    emoji: {
        url: emoji_urls,
        keys: emoji_keys
    },
    visual: {
        ball_emitting: 0,
        ball_gate: false,
        crush_ball: false,
        ball_mode: 'jet',
        large_note: '',
        bubble_burst: 0,
        pos: {
            face: [0, 0],
            hand: [0, 0],
            body: [0, 0]
        },
        viz: {
            face: 0,
            hand: 0,
            body: 0
        }
    },
    game: {
        countdown: 60,
        prep_countdown: 5,
        result_countdown: 5,
        state: 0,
        result: 0,
        gameplay: null,
        pads: {
            u: null, d: null, l: null, r: null, g: null
        }
    },
    cmd: {
        u: 0,
        d: 0,
        l: 0,
        r: 0,
        g: 0
    }
};

window.data = data;

export var vueData = data; //backward compatibility

var computed = data.computed;
window.computed = computed;

export var sensed_eased_patch = {
    hand_x_y: [],
    pose_x_y: {},
};

for (var i = 0; i < 21; i++) {
    sensed_eased_patch.hand_x_y.push([0, 0, 0]);
}

export var state_checks = {
    tracked: function (t, THRESHOLD) {
        return (!!data.tracked[t] && (Date.now() - data.tracked[t] < (THRESHOLD || STATE_NO_UPDATE_THRESHOLD)));
    }
};

const PATH = "http://localhost:8001/user"
var socket = io(PATH)

socket.on("video", (v) => {
    data.video_src = v.data;
    data.image.src = data.video_src;
});

socket.on("sense", function (d) {
    // console.log(d);
    for (var i in d) {
        if (d[i]) {
            data.sensed[i] = d[i] || data.sensed[i];
            if (!data.tracked[i]) {
                data.tracked[i] = 0;
            }
            data.tracked[i] = !!d[i] ? Date.now() : 0;
        }
    }
});

looperStart();

loop(() => {
    //compute sensors
    if (state_checks.tracked('paddlegesture', 100)) {
        data.computed.paddlegesture.gesture = data.sensed.paddlegesture.gesture;
    } else {
        data.computed.paddlegesture.gesture = "";
    }
    if (state_checks.tracked('hand', 300)) {
        var landmarks = data.sensed.hand.hand.landmarks;
        for (var i = 0; i < landmarks.length; i++) {
            for (var j = 0; j < 3; j++) {
                sensed_eased_patch.hand_x_y[i][j] = ease(
                    sensed_eased_patch.hand_x_y[i][j],
                    landmarks[i][j],
                    0.2, 0.0001
                )
            }
        }
        data.computed.hand.gesture = data.sensed.hand.gesture.state;
        data.computed.hand.direction = data.sensed.hand.gesture.direction;
    } else {
        data.computed.hand.gesture = "";
        data.computed.hand.direction = "";
    }
    if (state_checks.tracked('face')) {
        for (var i in data.sensed.face.expressions) {
            data.computed.face.emotions[i].value = data.sensed.face.expressions[i];
            data.computed.face.emotions[i].to = data.sensed.face.expressions[i];
        }
        var pos = data.sensed.face.landmarks._positions;
        var eyeL = pos[36];
        var eyeR = pos[45];
        var rel_eye = [eyeL._x - eyeR._x, eyeL._y - eyeR._y];
        var deg_face = Math.atan2(rel_eye[1], rel_eye[0]) / Math.PI * 180;
        if (deg_face > 0) {
            deg_face = 180 - deg_face;
        }
        else {
            deg_face = -(180 + deg_face);
        }
        data.computed.face.LR_VAL = deg_face;
        data.computed.face.LR.value = data.computed.face.LR.to = deg_face;

        var faceH = Math.abs(pos[27]._y - pos[8]._y);
        var noseTip = pos[33]._y;
        var faceCenter = (pos[1]._y + pos[15]._y) / 2;
        var deltaNose = noseTip - faceCenter;
        var ratio = deltaNose / faceH;
        computed.face.TD_VAL = ratio;
        computed.face.TD.to = computed.face.TD.value = ratio;

        var mouthT = pos[62];
        var mouthB = pos[66];
        var dMouth = Math.abs((mouthT._y - mouthB._y) / faceH);
        computed.face.MOUTH = dMouth;
        computed.face.MOUTH_E.value = dMouth;
        computed.face.MOUTH_E.to = dMouth;

    } else {
        data.computed.face.LR_VAL = 0;
        data.computed.face.LR.to = 0;
        computed.face.TD_VAL = 0;
        computed.face.TD.to = 0;
        computed.face.MOUTH = 0;
        computed.face.MOUTH_E.to = 0;
        for (var i in data.computed.face.emotions) {
            data.computed.face.emotions[i].to = 0;
        }
    }
    if (state_checks.tracked('pose')) {
        var landmarks = data.sensed.pose.keys;
        for (var i in landmarks) {
            sensed_eased_patch.pose_x_y[i] = sensed_eased_patch.pose_x_y[i] || [0, 0];
            sensed_eased_patch.pose_x_y[i][0] = ease(
                sensed_eased_patch.pose_x_y[i][0],
                landmarks[i].score > 0.02 ? landmarks[i].position.x : sensed_eased_patch.pose_x_y[i][0],
                0.05, 0.0001
            )
            sensed_eased_patch.pose_x_y[i][1] = ease(
                sensed_eased_patch.pose_x_y[i][1],
                landmarks[i].score > 0.02 ? landmarks[i].position.y : sensed_eased_patch.pose_x_y[i][1],
                0.2, 0.0001
            )
        }

        var LHAND_ABOVE_HEAD = landmarks.leftWrist.score > 0.5 && landmarks.leftWrist.position.y < landmarks.nose.position.y;
        var RHAND_ABOVE_HEAD = landmarks.rightWrist.score > 0.5 && landmarks.rightWrist.position.y < landmarks.nose.position.y;

        function ensureBoth(a, b) {
            return landmarks[a].score > 0.3 && landmarks[b].score > 0.3;
        }

        function degreeBetween(a, b) {
            var dx = landmarks[a].position.x - landmarks[b].position.x;
            var dy = landmarks[a].position.y - landmarks[b].position.y;
            var deg = Math.atan2(dy, dx) / Math.PI * 180;
            return deg;
        }

        var LARM_H = ensureBoth("leftElbow", "leftShoulder") && Math.abs(degreeBetween("leftElbow", "leftShoulder")) < 20;
        var RARM_H = ensureBoth("rightElbow", "rightShoulder") && Math.abs(degreeBetween("rightShoulder", "rightElbow")) < 20;

        if (LHAND_ABOVE_HEAD && RHAND_ABOVE_HEAD) {
            computed.pose.kind = "ABOVE_HEAD";
        }
        else if (LHAND_ABOVE_HEAD && RARM_H) {
            computed.pose.kind = "PL";
        }
        else if (RHAND_ABOVE_HEAD && LARM_H) {
            computed.pose.kind = "PR";
        }
        else if (RHAND_ABOVE_HEAD) {
            computed.pose.kind = "R";
        }
        else if (LHAND_ABOVE_HEAD) {
            computed.pose.kind = "L";
        }
        else {
            computed.pose.kind = "NONE";
        }

    }

    for (var i = 0; i < _vpads.length; i++) {
        _vpads[i].tick();
    }
});


var _vpads = [];
class vpad_desc {
    constructor(emoji, desc, evaluate, trigger_threshold = 0, hold_speed = 0.03) {
        this.state = 0;
        this.triggered = 0;
        this.trigger_threshold = trigger_threshold;
        this.desc = desc;
        this.emoji = emoji;
        //auto compute
        this.hold_speed = hold_speed;
        this.hold_score = 0;
        this.hold_score_e = eased(0, 0, 0.1, 0.0001);
        this.hold_strength = eased(0, 0, 0.1, 0.0001);
        this.evaluate = evaluate;
        this.bypass = false;
        _vpads.push(this);
    }
    tick() {
        this.state = this.evaluate(this) && !this.bypass;
        this.triggered = this.state && this.hold_score > this.trigger_threshold;
        if (this.state) {
            this.hold_strength.value = 1;
            this.hold_score += this.hold_speed * 1;
        } else {
            this.hold_score -= this.hold_speed * 0.5;
        }
        this.hold_score = clamp(this.hold_score, 0, 1);
        this.hold_score_e.to = this.hold_score;
    }
}

export var VPADS = {
    POSE_PL: new vpad_desc("POSE-HAND-UP-LEFT", "交警L", (pad) => {
        return computed.pose.kind == 'PL'
    }, 0.1, 0.008),
    POSE_PR: new vpad_desc("POSE-HAND-UP-RIGHT", "交警R", (pad) => {
        return computed.pose.kind == 'PR'
    }, 0.1, 0.008),
    POSE_L: new vpad_desc("POSE-LEFT", "举左", (pad) => {
        return computed.pose.kind == 'L'
    }, 0.1, 0.008),
    POSE_R: new vpad_desc("POSE-RIGHT", "举右", (pad) => {
        return computed.pose.kind == 'R'
    }, 0.1, 0.008),
    POSE_HANDS_UP: new vpad_desc("POSE-HEART", "LOVE", (pad) => {
        return computed.pose.kind == 'ABOVE_HEAD'
    }, 0.1, 0.008),
    FACE_MOUTH_OPEN: new vpad_desc("😲", "张嘴", (pad) => {
        return computed.face.MOUTH > 0.12;
    }, 0.1, 0.008),
    FACE_TILT_TOP: new vpad_desc("HEAD-UP", "上倾", (pad) => {
        return computed.face.TD < -0;
    }, 0.1, 0.008),
    FACE_TILT_BOTTOM: new vpad_desc("HEAD-DOWN", "下倾", (pad) => {
        return computed.face.TD > 0.25;
    }, 0.1, 0.008),
    FACE_TILT_LEFT: new vpad_desc("HEAD-LEFT", "左倾", (pad) => {
        return computed.face.LR < -10;
    }, 0.1, 0.008),
    FACE_TILT_RIGHT: new vpad_desc("HEAD-RIGHT", "右倾", (pad) => {
        return computed.face.LR > 10;
    }, 0.1, 0.008),
    EMOTION_SUPERHAPPY: new vpad_desc("😂", "大笑", (pad) => {
        return computed.face.emotions.happy.value > 0.95;
    }, 0.05, 0.02),
    EMOTION_HAPPY: new vpad_desc("😄", "笑脸", (pad) => {
        return computed.face.emotions.happy.value > 0.9;
    }, 0.1),
    EMOTION_SAD: new vpad_desc("😫", "伤心", (pad) => {
        return computed.face.emotions.sad.value > 0.7;
    }, 0.1),
    EMOTION_TOOTH: new vpad_desc("😬", "呲牙", (pad) => {
        return computed.face.emotions.angry.value > 0.5;
    }, 0.1),
    EMOTION_SUPRISE: new vpad_desc("😮", "吃惊", (pad) => {
        return computed.face.emotions.surprised.value > 0.7;
    }, 0.1),
    HAND_OK: new vpad_desc("👌", "OK", (pad) => {
        return computed.hand.gesture == 'ok';
    }, 0.2, 0.05),
    HAND_V: new vpad_desc("✌️", "YEAH", (pad) => {
        return computed.hand.gesture == 'v';
    }, 0.05),
    HAND_POINT: new vpad_desc("☝️", "举个栗子", (pad) => {
        return computed.hand.gesture == 'point';
    }, 0.2),
    HAND_FIST: new vpad_desc("👊", "握拳", (pad) => {
        return computed.hand.gesture == 'fist';
    }, 0.2),
    HAND_LOVE: new vpad_desc("🤟", "LOVE", (pad) => {
        return computed.hand.gesture == 'love';
    }, 0.2),
    HAND_CALL: new vpad_desc("🤙", "打Call", (pad) => {
        return computed.hand.gesture == '6';
    }, 0.2),
    HAND_PALM: new vpad_desc("✋", "击掌", (pad) => {
        return computed.hand.gesture == 'palm';
    }, 0.2),
    HAND_THUMB: new vpad_desc("👍", "点赞", (pad) => {
        return computed.hand.gesture == 'thumb';
    }, 0.2),

    //let ges = ['', 'palm', 'yeah', 'fist', 'point', 'ok'];
    //

    PD_HAND_OK: new vpad_desc("👌", "OK", (pad) => {
        // console.log(computed.paddlegesture.gesture);
        return computed.paddlegesture.gesture == 'ok';
    }, 0.2, 0.05),
    PD_HAND_YEAH: new vpad_desc("✌️", "YEAH", (pad) => {
        return computed.paddlegesture.gesture == 'yeah';
    }, 0.05),
    PD_HAND_POINT: new vpad_desc("☝️", "举个栗子", (pad) => {
        return computed.paddlegesture.gesture == 'point';
    }, 0.2),
    PD_HAND_FIST: new vpad_desc("👊", "握拳", (pad) => {
        return computed.paddlegesture.gesture == 'fist';
    }, 0.2),
    PD_HAND_PALM: new vpad_desc("✋", "击掌", (pad) => {
        return computed.paddlegesture.gesture == 'palm';
    }, 0.2)
};


data.vpads = VPADS;


//from old days

var gameplays = {
    "emotion": {
        viz: {
            face: [0.8, 1920 / 4, 1080 / 2],
            hand: [1.2, 1920 / 2 - 1920 / 7, 1080 / 2 + 1080 / 4],
            body: false
        },
        title: "表情帝",
        desc: `充分调动<br/>你内心的情绪<br />面部肌肉<br/>请开始你的表演～`,
        norm_pads: [
            VPADS.EMOTION_SUPRISE,
            VPADS.EMOTION_TOOTH,
            VPADS.EMOTION_SAD,
            VPADS.EMOTION_HAPPY
        ],
        grab_pads: [
            VPADS.HAND_OK
        ]
    },
    "pose": {
        viz: {
            face: false,
            hand: false,
            body: [1.2, 1920 / 4, 1080 / 2],
        },
        title: "体感",
        desc: `体感模式<br>/TEST`,
        norm_pads: [
            VPADS.POSE_L,
            VPADS.POSE_R,
            VPADS.POSE_PR,
            VPADS.POSE_PL
        ],
        grab_pads: [
            VPADS.POSE_HANDS_UP
        ]
    },
    "head_pose": {
        viz: {
            face: [1.2, 1920 / 4, 1080 / 2],
            hand: false,
            body: false
        },
        title: "颈椎病治疗仪",
        desc: `头部运动模式<br>/TEST`,
        norm_pads: [
            VPADS.FACE_TILT_BOTTOM,
            VPADS.FACE_TILT_LEFT,
            VPADS.FACE_TILT_RIGHT,
            VPADS.FACE_TILT_TOP
        ],
        grab_pads: [
            VPADS.FACE_MOUTH_OPEN
        ]
    },
    "hand": {
        viz: {
            face: false,
            hand: [1.6, 1920 / 4, 1080 / 2],
            body: false
        },
        title: "指挥家",
        desc: `伸出手手<br />遥控娃娃机`,
        norm_pads: [
            VPADS.HAND_CALL,
            VPADS.HAND_FIST,
            VPADS.HAND_LOVE,
            VPADS.HAND_PALM,
            VPADS.HAND_POINT,
            VPADS.HAND_V,
        ],
        grab_pads: [
            VPADS.HAND_OK
        ]
    },
    "paddlegesture": {
        viz: {
            face: false,
            hand: [1.6, 1920 / 4, 1080 / 2],
            body: false
        },
        title: "Paddle 手势",
        desc: `伸出手手<br />遥控娃娃机`,
        norm_pads: [
            VPADS.PD_HAND_FIST,
            VPADS.PD_HAND_YEAH,
            VPADS.PD_HAND_PALM,
            VPADS.PD_HAND_POINT
        ],
        grab_pads: [
            VPADS.PD_HAND_OK
        ]
    }
};

//GAME LOGIC
export var vue_computed = {
    game_active() {
        return vueData.game.state > 0
    },
    game_stage_prep() {
        return vueData.game.state == 1
    },
    game_stage_active() {
        return vueData.game.state == 2
    },
    game_is_running() {
        return vueData.game.state > 0 && vueData.game.state < 3;
    },
    game_stage_result() {
        return vueData.game.state == 3;
    },
    has_face() {
        return state_checks.tracked("face")
    },
    has_tracking() {
        return state_checks.tracked("face") || state_checks.tracked("pose") || state_checks.tracked("hand")
    }
};

export function reset_game() {
    vueData.game.state = 0;
    vueData.game.result = 0;
    vueData.game.countdown = 60;
    vueData.game.prep_countdown = 5;
    vueData.game.result_countdown = 3;
    vueData.game.gameplay = null;
    for (var i in vueData.game.pads) {
        vueData.game.pads[i] = null;
    }
}

export function get_pad(key) {
    return vueData.game.pads[key];
}
var game_play_id = 0;
export function start_game() {
    if (vue_computed.game_active()) {
        return;
    }
    reset_game();
    var arr = Object.keys(gameplays);
    //
    arr = ["paddlegesture"];
    console.log(arr);
    var q = pick(arr);
    game_play_id++;
    game_play_id = game_play_id % arr.length;
    vueData.game.gameplay = gameplays[arr[game_play_id]];
    console.log(vueData.game.gameplay);
    vueData.game.state = 1;
    shuffle_roller.value = 0;
}

export function end_game(res) {
    if (res == -100 && !window.OFFLINE_DEBUG) return;
    if (!vue_computed.game_active() || !vue_computed.game_stage_active()) {
        return;
    }
    // reset_game();
    // reset_game();
    vueData.game.result = res;
    vueData.game.state = 3;
    vueData.game.result_countdown = 3;

    socket.emit("reboot", true)
}

// start_game();

//TODO: this is a mess
var __pad_map = { u: 1, d: 2, l: 3, r: 4, g: 0 };
function shuffle_pads() {
    var gameplay = vueData.game.gameplay;
    if (!gameplay) return;
    var pads = vueData.game.pads;
    gameplay.norm_pads = shuffleArray(gameplay.norm_pads);
    gameplay.grab_pads = shuffleArray(gameplay.grab_pads);

    //clamp 
    var pick4 = [];
    for (var i = 0; i < 4; i++) {
        pick4[i] = gameplay.norm_pads[i];
    }

    //unshift
    var one = gameplay.grab_pads[0];
    pick4.unshift(one);

    for (var i in __pad_map) {
        pads[i] = pick4[__pad_map[i]];
    }

    return pick4; //becomes 5!
}


socket.on("machine", (game_state) => {
    if (game_state.game == 1) {
        vueData.game.state = 2;
    } else if (vueData.game.state == 2 && game_state.game == 0) {
        vueData.game.state = 3;
        vueData.game.result = game_state.result;
    }
});

//slow tick
setInterval(() => {
    if (vue_computed.game_stage_prep()) {
        vueData.game.prep_countdown--;
        vueData.game.prep_countdown = vueData.game.prep_countdown < 0 ? 0 : vueData.game.prep_countdown;
        if (vueData.game.prep_countdown == 0) {
            if (OFFLINE_DEBUG) {
                vueData.game.state = 2; //start game
            }
            socket.emit("req", 1);
        }
    }
    else if (vue_computed.game_stage_active()) {
        vueData.game.countdown--;
        vueData.game.countdown = vueData.game.countdown < 0 ? 0 : vueData.game.countdown;
        if (vueData.game.countdown == 0) {
            if (OFFLINE_DEBUG) {
                vueData.game.state = 3; //end game
            }
        }
    }
    else if (vue_computed.game_stage_result()) {
        vueData.game.result_countdown--;
        vueData.game.result_countdown = vueData.game.result_countdown < 0 ? 0 : vueData.game.result_countdown;
        if (vueData.game.result_countdown == 0) {
            vueData.game.state = 0; //start game
            reset_game();
        }
    }
}, 1000);

var prev = null;
//fast update
loop(() => {

    if (!vue_computed.game_active() || !vueData.game.gameplay) {
        vueData.visual.viz.face = 1;
        vueData.visual.viz.body = 0;
        vueData.visual.viz.hand = 0;
        if (!vue_computed.has_face()) {
            vueData.visual.pos.face[0] = 1920 / 2;
            vueData.visual.pos.face[1] = 1080 / 2;
        } else {
            vueData.visual.pos.face[0] = 1920 / 4;
        }
    }
    else {
        var gameplay = vueData.game.gameplay;
        for (var i in gameplay.viz) {
            if (gameplay.viz[i]) {
                vueData.visual.viz[i] = gameplay.viz[i][0];
                vueData.visual.pos[i][0] = gameplay.viz[i][1];
                vueData.visual.pos[i][1] = gameplay.viz[i][2];
            } else {
                vueData.visual.viz[i] = 0;
            }
        }
    }

    if (vue_computed.game_stage_prep()) {
        var probability_of_shuffle = (vueData.game.prep_countdown / 5);
        probability_of_shuffle = probability_of_shuffle * probability_of_shuffle * 0.8;
        if (Math.random() < probability_of_shuffle) {
            shuffle_pads();
        }
    }
    //check cmd
    var new_cmd = JSON.parse(JSON.stringify(vueData.cmd));
    prev = prev || new_cmd;

    for (var i in new_cmd) {
        if (prev[i] != new_cmd[i]) {
            socket.emit("ctrl", new_cmd);
            console.log(new_cmd);
            break;
        }
    }

    prev = new_cmd;
});


window.start_game = start_game;
window.reset_game = reset_game;