import "babel-polyfill";
import * as handtrack from '../patches/hand-pose-patched';
import * as fp from "fingerpose";


const GE = new fp.GestureEstimator([
    fp.Gestures.VictoryGesture,
    fp.Gestures.ThumbsUpGesture
], {
    NO_CURL_START_LIMIT: 150
});
const FPD = GE.estimator;

var model;
export var state = {
    loaded: false,
    busy: false,
    result: {},
    req: 0
};


export function init() {
    console.log("Loading hand engine")
    console.log(handtrack);
    return handtrack.load().then((m) => {
        console.log("Loaded")
        state.loaded = true;
        model = m;
    });
}

function compute_gesture(result) {
    if (!result) return null;
    // var gs = GE.estimate(result.landmarks, 7.5);
    // console.log(
    //     JSON.stringify(gs, 4, "\t"));
    var fq = FPD.estimate(result.landmarks);

    // console.log(
    //     JSON.stringify(fq, 4, "\t"));

    //lets hard code some
    var curls = fq.curls;
    var dirs = fq.directions;

    var gesture = null;
    var main_direction = null;
    if (curls[0] > 0 && curls[1] > 0 && curls[2] > 0 && curls[3] > 0 && curls[4] > 0) {
        gesture = "fist";
        main_direction = "up";
    }
    else if (curls[0] == 0 && curls[1] > 0 && curls[2] > 0 && curls[3] > 0 && curls[4] > 0 && (
        dirs[0] == 0 || dirs[0] == 4 || dirs[0] == 5
    )) {
        gesture = "thumb";
        main_direction = "up";
        if (dirs[0] == 7 || dirs[0] == 1 || dirs[0] == 6) {
            main_direction = "down";
        }
    }
    else if (curls[1] == 0 && curls[2] == 0 && curls[3] > 0 && curls[4] > 0) {
        gesture = "v";
        main_direction = "up";
        if (dirs[1] == 5 || dirs[1] == 4 || dirs[1] == 0) {
            main_direction = "up";
        }
        else if (dirs[1] == 2 || dirs[1] == 7) {
            main_direction = "left";
        }
        else if (dirs[1] == 3 || dirs[1] == 6) {
            main_direction = "right";
        }
    }
    else if (curls[0] == 0 && curls[1] > 0 && curls[2] > 0 && curls[3] > 0 && curls[4] == 0) {
        gesture = "6";
        main_direction = "up";
    }
    else if (curls[0] == 0 && curls[1] == 0 && curls[2] > 0 && curls[3] > 0 && curls[4] == 0) {
        gesture = "love";
        main_direction = "up";
    }
    else if (curls[0] > 0 && curls[1] > 0 && curls[2] > 0 && curls[3] > 0 && curls[4] == 0) {
        gesture = "pinky";
        main_direction = "up";
    }
    else if (curls[0] > 0 && curls[1] == 0 && curls[2] > 0 && curls[3] > 0 && curls[4] > 0) {
        gesture = "point";
        main_direction = "up";
    }
    else if (curls[0] == 0 && curls[1] == 0 && curls[2] == 0 && curls[3] == 0 && curls[4] == 0) {
        gesture = "palm";
        main_direction = "up";
    }
    else if (curls[0] > 0 && curls[1] > 0 && curls[2] == 0 && curls[3] == 0 && curls[4] == 0) {
        gesture = "ok";
        main_direction = "up";
    }
    return {
        state: gesture,
        direction: main_direction
    }
}

export function detect(input, io) {
    if (!state.loaded || state.busy) {
        return;
    }
    if (state.req <= 2) {
        state.req++;
        return;
    }
    state.req = 0;
    state.busy = true;
    var time_started = Date.now();
    model.estimateHands(input).then((result) => {
        var time_ended = Date.now();
        var delta = time_ended - time_started;
        state.cost = delta;
        state.busy = false;
        var estimation = result[0];
        state.result.hand = estimation;
        state.result.gesture = compute_gesture(estimation);
        // console.log(state.result.gesture);
        io(estimation ? state.result : null);
    }).catch(e => {
        console.log(e);
        state.busy = false;
    });
}

function drawPoint(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

export function render(ctx) {
    if (state.result && state.result.hand) {
        var p = state.result.hand;
        for (let part in p.annotations) {
            for (let point of p.annotations[part]) {
                drawPoint(ctx, point[0], point[1], 3, '#f00');
            }
        }
    }
}