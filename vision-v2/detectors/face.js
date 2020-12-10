import * as fapi from "face-api.js";

export var state = {
    loaded: false,
    busy: false,
    req: 0,
    result: {},
};

export function init() {
    console.log("Loading face engine")
    var root = config.models + "/face-api.js-models/";
    return Promise.all([
        fapi.loadAgeGenderModel(root),
        fapi.loadFaceDetectionModel(root),
        fapi.loadFaceExpressionModel(root),
        fapi.loadFaceLandmarkModel(root),
        fapi.loadFaceLandmarkTinyModel(root),
        fapi.loadFaceRecognitionModel(root),
        fapi.loadTinyFaceDetectorModel(root),
        fapi.loadTinyYolov2Model(root),
    ]).then(() => {
        state.loaded = true;
        console.log('Face engine loaded!')
    });
}

var opts = new fapi.TinyYolov2Options({
    inputSize: fapi.TinyYolov2SizeType.LG,
    scoreThreshold: 0.2
})

export function detect(input, io) {
    if (!state.loaded || state.busy) {
        return;
    }
    // if (state.req <= 2) {
    //     state.req++;
    //     return;
    // }
    state.busy = true;
    var time_started = Date.now();
    fapi
        .detectSingleFace(input, opts)
        .withFaceLandmarks(true)
        .withFaceExpressions()
        .then(result => {
            state.busy = false;
            state.result = result;
            var time_ended = Date.now();
            var delta = time_ended - time_started;
            state.cost = delta;
            io(result);
            // console.log(result);
        })
        .catch((e) => {
            console.log(e);
            state.busy = false;
        })
}

export function render(ctx) {
    if (state.result && state.result.detection) {
        var x = state.result.detection.box.x;
        var y = state.result.detection.box.y;
        var width = state.result.detection.box.width;
        var height = state.result.detection.box.height;
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
        ctx.fillRect(x, y, width, height);
    }
}
