import 'babel-polyfill';
import Paddlejs from '../lib/paddlejs/src/executor/runner';
import DetectProcess from '../lib/paddle-gesture/DetectProcess';
import LMProcess from '../lib/paddle-gesture/LMProcess';
import WarpAffine from '../lib/paddle-gesture/warpAffine';

export var state = {
    loaded: false,
    busy: false,
    req: 0,
    result: {},
    length: 0
};

var paddlejs, paddlejs2, anchorResults;

export function init() {
    paddlejs = new Paddlejs({
        modelPath: '../models/detect',
        fileCount: 2,
        feedShape: {
            fw: 256,
            fh: 256
        },
        fetchShape: [1, 1, 1920, 10],
        needBatch: true,
        fill: '#fff',
        targetSize: { height: 256, width: 256 },
        needPostProcess: false
    });

    const waitPaddle1 = paddlejs.loadModel();
    paddlejs2 = new Paddlejs({
        modelPath: '../models/rec',
        fileCount: 1,
        feedShape: {
            fw: 224,
            fh: 224
        },
        fetchShape: [1, 1, 1, 9],
        fill: '#fff',
        targetSize: { height: 224, width: 224 },
        needBatch: true,
        needPostProcess: false
    })

    const waitPaddle2 = paddlejs2.loadModel();

    WarpAffine.init({
        width: 224,
        height: 224
    });

    const waitAnchor = fetch("./models/anchor-paddle-hand.txt").then(async (res) => {
        anchorResults = await res.text();
        anchorResults = anchorResults.replace(/\s+/g, ',').split(',').map(item => +item);
    });

    return Promise.all([waitPaddle1, waitPaddle2, waitAnchor]).then(() => {
        state.loaded = true;
        console.log('Paddle gesture engine loaded!')
    })
}

// setInterval(()=>{
//     if(state.busy && state.reboot){
//         state.busy = false;
//     }
// }, 1000)

export function detect(input, io) {
    // console.log(
    //     "BUSY ", state.busy,
    //     "loaded ", !state.loaded
    // );
    if (!state.loaded || state.busy) {
        return;
    }
    // console.log("delete?????");
    // if (state.req <= 2) {
    //     state.req++;
    //     return;
    // }
    state.busy = true;
    var time_started = Date.now();
    var timer = setTimeout(()=>{
        location.reload();
    }, 500)
    // fapi
    //     .detectSingleFace(input, opts)
    //     .withFaceLandmarks(true)
    //     .withFaceExpressions()
    //     .then(result => {
    //         state.busy = false;
    //         state.result = result;
    //         var time_ended = Date.now();
    //         var delta = time_ended - time_started;
    //         state.cost = delta;
    //         io(result);
    //         // console.log(result);
    //     })
    //     .catch((e) => {
    //         console.log(e);
    //         state.busy = false;
    //     })

    loop(input)
        .then(v=>{
            var time_ended = Date.now();
            var delta = time_ended - time_started;
            state.cost = delta;
          //  console.log(state.result);
            console.log(v);
            // (v == null) && state.length ++;
            // console.log(state.length);
            io(v);
            state.busy = false;
            clearTimeout(timer)
            if(state.length > 300){
                location.reload();
            }
        }).catch((e)=>{
            console.log(e);
        });

    // paddlejs.predict(input, postProcess).then((v) => {
    //     var time_ended = Date.now();
    //     var delta = time_ended - time_started;
    //     state.cost = delta;
    //     console.log(state.result);
    //     console.log(v)
    //     io(state.result);
    //     state.busy = false;
    // })

    // .then(v=>{
    //     console.log(v);
    //     result = v;
    // })
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

var result = null;
function loop(input) {
    // console.log("执行模型")
    return new Promise((res, err) =>{    
        paddlejs.predict(input, postProcess)
        async function postProcess(data) {
            if(!data || data.length == 0) {
                location.reload();
            }   
            // console.log("后处理")
            // console.log(data);
            let post = new DetectProcess(data, paddlejs.io.fromPixels2DContext.canvas);
            var box = await post.outputBox(anchorResults);
            if (!box) {
                state.result.gesture = "";
                result = {gesture: ""}
                return res(result);
            }
            // console.log(box);
            let feed = await post.outputFeed(paddlejs);
            // 第一个模型的后处理可以直接拿到feed
            // await new Promise((res) => {
            paddlejs2.runWithFeed(feed, async function (data) {
                // console.log("结果")
                let lmProcess = new LMProcess(data);
                await lmProcess.output();
                state.result.gesture = lmProcess.type;
                // return res();
                result = {gesture: lmProcess.type};
                return res(result);
            })
            // }).then();
            }
    })
    // console.log("return result")
}