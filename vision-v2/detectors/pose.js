import * as posenet from '@tensorflow-models/posenet';

export var state = {
    loaded: false,
    busy: false,
    result: null,
    req: 0
};

var model;

export function init() {
    console.log("Loading pose engine")
    // posenet.load({
    //     architecture: 'MobileNetV1',
    //     outputStride: 16,
    //     inputResolution: { width: 640, height: 480 },
    //     multiplier: 0.75
    // }).then(m => {
    //     console.log("Loaded");
    //     state.loaded = true;
    //     model = m;
    // });
    return posenet.load({
        architecture: 'ResNet50',
        outputStride: 32,
        inputResolution: { width: 257, height: 200 },
        quantBytes: 2,
        modelUrl: config.models + "/resnet50/model.json"
    }).then(m => {
        console.log("Pose Engine loaded");
        state.loaded = true;
        model = m;
    });
}

var detection_skipper = 0;
export function detect(input, io) {
    if (!state.loaded || state.busy) {
        return;
    }
    state.busy = true;
    detection_skipper++;
    if (detection_skipper % 4 == 0) {
    }
    else {
        state.busy = false;
        return; //yield
    }
    var time_started = Date.now();
    model.estimateMultiplePoses(input, {
        flipHorizontal: false,
        maxDetections: 5,
        scoreThreshold: 0.5,
        nmsRadius: 20
    }).then((result) => {
        var time_ended = Date.now();
        var delta = time_ended - time_started;
        state.cost = delta;
        state.busy = false;
        // var estimation = result[0];
        if (!result) return;
        result.forEach(v => {
            var x0 = 10000;
            var x1 = 0;
            var y0 = 10000;
            var y1 = 0;
            var cx = 0;
            var cy = 0;
            var w = 0;
            var h = 0;
            v.keypoints.forEach(v => {
                x0 = Math.min(x0, v.position.x);
                x1 = Math.max(x1, v.position.x);
                y0 = Math.min(y0, v.position.y);
                y1 = Math.max(y1, v.position.y);
            });
            cx = (x0 + x1) / 2
            cy = (y0 + y1) / 2
            w = x1 - x0;
            h = y1 - y0;
            v.rect = {
                x0: x0,
                x1: x1,
                y0: y0,
                y1: y1,
                center: { x: cx, y: cy },
                w: w,
                h: h,
                area: w * h,
                dist_to_center: Math.sqrt(Math.pow(cx - 640 / 2, 2) + Math.pow(cy - 480 / 2, 2))
            };

        });

        result = result.sort(((a, b) => {
            return -a.rect.area + b.rect.area
        }))[0];

        if (!result) {
            return io(null);
        }
        state.result = result;
        var person = result;
        person.keys = {};
        person.keypoints.forEach(v => {
            person.keys[v.part] = v;
        });
        io(result ? state.result : null);


    }).catch(e => {
        console.log(e);
        state.busy = false;
    });
    // model.estimateMultiplePoses(input, {
    //     flipHorizontal: false,
    //     maxDetections: 5,
    //     scoreThreshold: 0.5,
    //     nmsRadius: 20
    // }).then((result) => {
    //     var time_ended = Date.now();
    //     var delta = time_ended - time_started;
    //     state.cost = delta;
    //     state.busy = false;
    //     // var estimation = result[0];
    //     if (!result) return;
    //     result.forEach(v => {
    //         var x0 = 10000;
    //         var x1 = 0;
    //         var y0 = 10000;
    //         var y1 = 0;
    //         var cx = 0;
    //         var cy = 0;
    //         var w = 0;
    //         var h = 0;
    //         v.keypoints.forEach(v => {
    //             x0 = Math.min(x0, v.position.x);
    //             x1 = Math.max(x1, v.position.x);
    //             y0 = Math.min(y0, v.position.y);
    //             y1 = Math.max(y1, v.position.y);
    //         });
    //         cx = (x0 + x1) / 2
    //         cy = (y0 + y1) / 2
    //         w = x1 - x0;
    //         h = y1 - y0;
    //         v.rect = {
    //             x0: x0,
    //             x1: x1,
    //             y0: y0,
    //             y1: y1,
    //             center: { x: cx, y: cy },
    //             w: w,
    //             h: h,
    //             area: w * h,
    //             dist_to_center: Math.sqrt(Math.pow(cx - 640 / 2, 2) + Math.pow(cy - 480 / 2, 2))
    //         };

    //     });

    //     result = result.sort(((a, b) => {
    //         return -a.rect.area + b.rect.area
    //     }))[0];

    //     if (!result) {
    //         return io(null);
    //     }
    //     state.result = result;
    //     var person = result;
    //     person.keys = {};
    //     person.keypoints.forEach(v => {
    //         person.keys[v.part] = v;
    //     });
    //     io(result ? state.result : null);


    // }).catch(e => {
    //     console.log(e);
    //     state.busy = false;
    // });
}

function drawPoint(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

export function render(ctx) {
    if (state.result && state.result.keypoints) {
        state.result.keypoints.forEach(v => {
            if (v.score > 0.5) {
                drawPoint(ctx, v.position.x, v.position.y, 2, "red");
            }
        });
    }
    // if (state.result && state.result.hand) {
    //     var p = state.result.hand;
    //     for (let part in p.annotations) {
    //         for (let point of p.annotations[part]) {
    //             drawPoint(ctx, point[0], point[1], 3, '#f00');
    //         }
    //     }
    // }
}