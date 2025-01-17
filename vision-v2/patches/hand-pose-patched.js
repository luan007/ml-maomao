/**
    * @license
    * Copyright 2020 Google LLC. All Rights Reserved.
    * Licensed under the Apache License, Version 2.0 (the "License");
    * you may not use this file except in compliance with the License.
    * You may obtain a copy of the License at
    *
    * http://www.apache.org/licenses/LICENSE-2.0
    *
    * Unless required by applicable law or agreed to in writing, software
    * distributed under the License is distributed on an "AS IS" BASIS,
    * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    * See the License for the specific language governing permissions and
    * limitations under the License.
    * =============================================================================
    */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@tensorflow/tfjs-core'), require('@tensorflow/tfjs-converter')) :
        typeof define === 'function' && define.amd ? define(['exports', '@tensorflow/tfjs-core', '@tensorflow/tfjs-converter'], factory) :
            (factory((global.handpose = {}), global.tf, global.tf));
}(this, (function (exports, tf, tfconv) {
    'use strict';

    function getBoxSize(box) {
        return [
            Math.abs(box.endPoint[0] - box.startPoint[0]),
            Math.abs(box.endPoint[1] - box.startPoint[1])
        ];
    }
    function getBoxCenter(box) {
        return [
            box.startPoint[0] + (box.endPoint[0] - box.startPoint[0]) / 2,
            box.startPoint[1] + (box.endPoint[1] - box.startPoint[1]) / 2
        ];
    }
    function cutBoxFromImageAndResize(box, image, cropSize) {
        const h = image.shape[1];
        const w = image.shape[2];
        const boxes = [[
            box.startPoint[1] / h, box.startPoint[0] / w, box.endPoint[1] / h,
            box.endPoint[0] / w
        ]];
        return tf.image.cropAndResize(image, boxes, [0], cropSize);
    }
    function scaleBoxCoordinates(box, factor) {
        const startPoint = [box.startPoint[0] * factor[0], box.startPoint[1] * factor[1]];
        const endPoint = [box.endPoint[0] * factor[0], box.endPoint[1] * factor[1]];
        const palmLandmarks = box.palmLandmarks.map((coord) => {
            const scaledCoord = [coord[0] * factor[0], coord[1] * factor[1]];
            return scaledCoord;
        });
        return { startPoint, endPoint, palmLandmarks };
    }
    function enlargeBox(box, factor = 1.5) {
        const center = getBoxCenter(box);
        const size = getBoxSize(box);
        const newHalfSize = [factor * size[0] / 2, factor * size[1] / 2];
        const startPoint = [center[0] - newHalfSize[0], center[1] - newHalfSize[1]];
        const endPoint = [center[0] + newHalfSize[0], center[1] + newHalfSize[1]];
        return { startPoint, endPoint, palmLandmarks: box.palmLandmarks };
    }
    function squarifyBox(box) {
        const centers = getBoxCenter(box);
        const size = getBoxSize(box);
        const maxEdge = Math.max(...size);
        const halfSize = maxEdge / 2;
        const startPoint = [centers[0] - halfSize, centers[1] - halfSize];
        const endPoint = [centers[0] + halfSize, centers[1] + halfSize];
        return { startPoint, endPoint, palmLandmarks: box.palmLandmarks };
    }
    function shiftBox(box, shiftFactor) {
        const boxSize = [
            box.endPoint[0] - box.startPoint[0], box.endPoint[1] - box.startPoint[1]
        ];
        const shiftVector = [boxSize[0] * shiftFactor[0], boxSize[1] * shiftFactor[1]];
        const startPoint = [box.startPoint[0] + shiftVector[0], box.startPoint[1] + shiftVector[1]];
        const endPoint = [box.endPoint[0] + shiftVector[0], box.endPoint[1] + shiftVector[1]];
        return { startPoint, endPoint, palmLandmarks: box.palmLandmarks };
    }

    class HandDetector {
        constructor(model, width, height, anchors, iouThreshold, scoreThreshold) {
            this.model = model;
            this.width = width;
            this.height = height;
            this.iouThreshold = iouThreshold;
            this.scoreThreshold = scoreThreshold;
            this.anchors = anchors.map(anchor => [anchor.x_center, anchor.y_center]);
            this.anchorsTensor = tf.tensor2d(this.anchors);
            this.inputSizeTensor = tf.tensor1d([width, height]);
            this.doubleInputSizeTensor = tf.tensor1d([width * 2, height * 2]);
        }
        normalizeBoxes(boxes) {
            return tf.tidy(() => {
                const boxOffsets = tf.slice(boxes, [0, 0], [-1, 2]);
                const boxSizes = tf.slice(boxes, [0, 2], [-1, 2]);
                const boxCenterPoints = tf.add(tf.div(boxOffsets, this.inputSizeTensor), this.anchorsTensor);
                const halfBoxSizes = tf.div(boxSizes, this.doubleInputSizeTensor);
                const startPoints = tf.mul(tf.sub(boxCenterPoints, halfBoxSizes), this.inputSizeTensor);
                const endPoints = tf.mul(tf.add(boxCenterPoints, halfBoxSizes), this.inputSizeTensor);
                return tf.concat2d([startPoints, endPoints], 1);
            });
        }
        normalizeLandmarks(rawPalmLandmarks, index) {
            return tf.tidy(() => {
                const landmarks = tf.add(tf.div(rawPalmLandmarks.reshape([-1, 7, 2]), this.inputSizeTensor), this.anchors[index]);
                return tf.mul(landmarks, this.inputSizeTensor);
            });
        }
        async getBoundingBoxes(input) {
            const normalizedInput = tf.tidy(() => tf.mul(tf.sub(input, 0.5), 2));
            const savedWebglPackDepthwiseConvFlag = tf.env().get('WEBGL_PACK_DEPTHWISECONV');
            tf.env().set('WEBGL_PACK_DEPTHWISECONV', true);
            const batchedPrediction = this.model.predict(normalizedInput);
            tf.env().set('WEBGL_PACK_DEPTHWISECONV', savedWebglPackDepthwiseConvFlag);
            const prediction = batchedPrediction.squeeze();
            const scores = tf.tidy(() => tf.sigmoid(tf.slice(prediction, [0, 0], [-1, 1])).squeeze());
            const rawBoxes = tf.slice(prediction, [0, 1], [-1, 4]);
            const boxes = this.normalizeBoxes(rawBoxes);
            const savedConsoleWarnFn = console.warn;
            console.warn = () => { };
            const boxesWithHandsTensor = tf.image.nonMaxSuppression(boxes, scores, 1, this.iouThreshold, this.scoreThreshold);
            console.warn = savedConsoleWarnFn;
            const boxesWithHands = await boxesWithHandsTensor.array();
            const toDispose = [
                normalizedInput, batchedPrediction, boxesWithHandsTensor, prediction,
                boxes, rawBoxes, scores
            ];
            if (boxesWithHands.length === 0) {
                toDispose.forEach(tensor => tensor.dispose());
                return null;
            }
            const boxIndex = boxesWithHands[0];
            const matchingBox = tf.slice(boxes, [boxIndex, 0], [1, -1]);
            const rawPalmLandmarks = tf.slice(prediction, [boxIndex, 5], [1, 14]);
            const palmLandmarks = tf.tidy(() => this.normalizeLandmarks(rawPalmLandmarks, boxIndex).reshape([
                -1, 2
            ]));
            toDispose.push(rawPalmLandmarks);
            toDispose.forEach(tensor => tensor.dispose());
            return { boxes: matchingBox, palmLandmarks };
        }
        async estimateHandBounds(input) {
            const inputHeight = input.shape[1];
            const inputWidth = input.shape[2];
            const image = tf.tidy(() => input.resizeBilinear([this.width, this.height]).div(255));
            const prediction = await this.getBoundingBoxes(image);
            if (prediction === null) {
                image.dispose();
                return null;
            }
            const boundingBoxes = prediction.boxes.arraySync();
            const startPoint = boundingBoxes[0].slice(0, 2);
            const endPoint = boundingBoxes[0].slice(2, 4);
            const palmLandmarks = prediction.palmLandmarks.arraySync();
            image.dispose();
            prediction.boxes.dispose();
            prediction.palmLandmarks.dispose();
            return scaleBoxCoordinates({ startPoint, endPoint, palmLandmarks }, [inputWidth / this.width, inputHeight / this.height]);
        }
    }

    const MESH_ANNOTATIONS = {
        thumb: [1, 2, 3, 4],
        indexFinger: [5, 6, 7, 8],
        middleFinger: [9, 10, 11, 12],
        ringFinger: [13, 14, 15, 16],
        pinky: [17, 18, 19, 20],
        palmBase: [0]
    };

    function rotate(image, radians, fillValue, center) {
        const cpuBackend = tf.backend();
        const output = tf.buffer(image.shape, image.dtype);
        const [batch, imageHeight, imageWidth, numChannels] = image.shape;
        const centerX = imageWidth * (typeof center === 'number' ? center : center[0]);
        const centerY = imageHeight * (typeof center === 'number' ? center : center[1]);
        const sinFactor = Math.sin(-radians);
        const cosFactor = Math.cos(-radians);
        const imageVals = cpuBackend.readSync(image.dataId);
        for (let batchIdx = 0; batchIdx < batch; batchIdx++) {
            for (let row = 0; row < imageHeight; row++) {
                for (let col = 0; col < imageWidth; col++) {
                    for (let channel = 0; channel < numChannels; channel++) {
                        const coords = [batch, row, col, channel];
                        const x = coords[2];
                        const y = coords[1];
                        let coordX = (x - centerX) * cosFactor - (y - centerY) * sinFactor;
                        let coordY = (x - centerX) * sinFactor + (y - centerY) * cosFactor;
                        coordX = Math.round(coordX + centerX);
                        coordY = Math.round(coordY + centerY);
                        let outputValue = fillValue;
                        if (typeof fillValue !== 'number') {
                            if (channel === 3) {
                                outputValue = 255;
                            }
                            else {
                                outputValue = fillValue[channel];
                            }
                        }
                        if (coordX >= 0 && coordX < imageWidth && coordY >= 0 &&
                            coordY < imageHeight) {
                            const imageIdx = batchIdx * imageWidth * imageHeight * numChannels +
                                coordY * (imageWidth * numChannels) + coordX * numChannels +
                                channel;
                            outputValue = imageVals[imageIdx];
                        }
                        const outIdx = batchIdx * imageWidth * imageHeight * numChannels +
                            row * (imageWidth * numChannels) + col * numChannels + channel;
                        output.values[outIdx] = outputValue;
                    }
                }
            }
        }
        return output.toTensor();
    }

    function rotate$1(image, radians, fillValue, center) {
        const imageShape = image.shape;
        const imageHeight = imageShape[1];
        const imageWidth = imageShape[2];
        const sinFactor = Math.sin(radians);
        const cosFactor = Math.cos(radians);
        const centerX = Math.floor(imageWidth * (typeof center === 'number' ? center : center[0]));
        const centerY = Math.floor(imageHeight * (typeof center === 'number' ? center : center[1]));
        let fillSnippet = '';
        if (typeof fillValue === 'number') {
            fillSnippet = `float outputValue = ${fillValue.toFixed(2)};`;
        }
        else {
            fillSnippet = `
        vec3 fill = vec3(${fillValue.join(',')});
        float outputValue = fill[coords[3]];`;
        }
        const program = {
            variableNames: ['Image'],
            outputShape: imageShape,
            userCode: `
        void main() {
          ivec4 coords = getOutputCoords();
          int x = coords[2];
          int y = coords[1];
          int coordX = int(float(x - ${centerX}) * ${cosFactor} -
            float(y - ${centerY}) * ${sinFactor});
          int coordY = int(float(x - ${centerX}) * ${sinFactor} +
            float(y - ${centerY}) * ${cosFactor});
          coordX = int(coordX + ${centerX});
          coordY = int(coordY + ${centerY});
  
          ${fillSnippet}
  
          if(coordX > 0 && coordX < ${imageWidth} && coordY > 0 && coordY < ${imageHeight}) {
            outputValue = getImage(coords[0], coordY, coordX, coords[3]);
          }
  
        setOutput(outputValue);
      }`
        };
        const webglBackend = tf.backend();
        return webglBackend.compileAndRun(program, [image]);
    }

    function normalizeRadians(angle) {
        return angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
    }
    function computeRotation(point1, point2) {
        const radians = Math.PI / 2 - Math.atan2(-(point2[1] - point1[1]), point2[0] - point1[0]);
        return normalizeRadians(radians);
    }
    const buildTranslationMatrix = (x, y) => ([[1, 0, x], [0, 1, y], [0, 0, 1]]);
    function dot(v1, v2) {
        let product = 0;
        for (let i = 0; i < v1.length; i++) {
            product += v1[i] * v2[i];
        }
        return product;
    }
    function getColumnFrom2DArr(arr, columnIndex) {
        const column = [];
        for (let i = 0; i < arr.length; i++) {
            column.push(arr[i][columnIndex]);
        }
        return column;
    }
    function multiplyTransformMatrices(mat1, mat2) {
        const product = [];
        const size = mat1.length;
        for (let row = 0; row < size; row++) {
            product.push([]);
            for (let col = 0; col < size; col++) {
                product[row].push(dot(mat1[row], getColumnFrom2DArr(mat2, col)));
            }
        }
        return product;
    }
    function buildRotationMatrix(rotation, center) {
        const cosA = Math.cos(rotation);
        const sinA = Math.sin(rotation);
        const rotationMatrix = [[cosA, -sinA, 0], [sinA, cosA, 0], [0, 0, 1]];
        const translationMatrix = buildTranslationMatrix(center[0], center[1]);
        const translationTimesRotation = multiplyTransformMatrices(translationMatrix, rotationMatrix);
        const negativeTranslationMatrix = buildTranslationMatrix(-center[0], -center[1]);
        return multiplyTransformMatrices(translationTimesRotation, negativeTranslationMatrix);
    }
    function invertTransformMatrix(matrix) {
        const rotationComponent = [[matrix[0][0], matrix[1][0]], [matrix[0][1], matrix[1][1]]];
        const translationComponent = [matrix[0][2], matrix[1][2]];
        const invertedTranslation = [
            -dot(rotationComponent[0], translationComponent),
            -dot(rotationComponent[1], translationComponent)
        ];
        return [
            rotationComponent[0].concat(invertedTranslation[0]),
            rotationComponent[1].concat(invertedTranslation[1]),
            [0, 0, 1]
        ];
    }
    function rotatePoint(homogeneousCoordinate, rotationMatrix) {
        return [
            dot(homogeneousCoordinate, rotationMatrix[0]),
            dot(homogeneousCoordinate, rotationMatrix[1])
        ];
    }

    const UPDATE_REGION_OF_INTEREST_IOU_THRESHOLD = 0.8;
    const PALM_BOX_SHIFT_VECTOR = [0, -0.4];
    const PALM_BOX_ENLARGE_FACTOR = 3;
    const HAND_BOX_SHIFT_VECTOR = [0, -0.1];
    const HAND_BOX_ENLARGE_FACTOR = 1.65;
    const PALM_LANDMARK_IDS = [0, 5, 9, 13, 17, 1, 2];
    const PALM_LANDMARKS_INDEX_OF_PALM_BASE = 0;
    const PALM_LANDMARKS_INDEX_OF_MIDDLE_FINGER_BASE = 2;
    class HandPipeline {
        constructor(boundingBoxDetector, meshDetector, meshWidth, meshHeight, maxContinuousChecks, detectionConfidence) {
            this.regionsOfInterest = [];
            this.runsWithoutHandDetector = 0;
            this.boundingBoxDetector = boundingBoxDetector;
            this.meshDetector = meshDetector;
            this.maxContinuousChecks = maxContinuousChecks;
            this.detectionConfidence = detectionConfidence;
            this.meshWidth = meshWidth;
            this.meshHeight = meshHeight;
            this.maxHandsNumber = 1;
        }
        getBoxForPalmLandmarks(palmLandmarks, rotationMatrix) {
            const rotatedPalmLandmarks = palmLandmarks.map((coord) => {
                const homogeneousCoordinate = [...coord, 1];
                return rotatePoint(homogeneousCoordinate, rotationMatrix);
            });
            const boxAroundPalm = this.calculateLandmarksBoundingBox(rotatedPalmLandmarks);
            return enlargeBox(squarifyBox(shiftBox(boxAroundPalm, PALM_BOX_SHIFT_VECTOR)), PALM_BOX_ENLARGE_FACTOR);
        }
        getBoxForHandLandmarks(landmarks) {
            const boundingBox = this.calculateLandmarksBoundingBox(landmarks);
            const boxAroundHand = enlargeBox(squarifyBox(shiftBox(boundingBox, HAND_BOX_SHIFT_VECTOR)), HAND_BOX_ENLARGE_FACTOR);
            const palmLandmarks = [];
            for (let i = 0; i < PALM_LANDMARK_IDS.length; i++) {
                palmLandmarks.push(landmarks[PALM_LANDMARK_IDS[i]].slice(0, 2));
            }
            boxAroundHand.palmLandmarks = palmLandmarks;
            return boxAroundHand;
        }
        transformRawCoords(rawCoords, box, angle, rotationMatrix) {
            const boxSize = getBoxSize(box);
            const scaleFactor = [boxSize[0] / this.meshWidth, boxSize[1] / this.meshHeight];
            const coordsScaled = rawCoords.map((coord) => {
                return [
                    scaleFactor[0] * (coord[0] - this.meshWidth / 2),
                    scaleFactor[1] * (coord[1] - this.meshHeight / 2), coord[2]
                ];
            });
            const coordsRotationMatrix = buildRotationMatrix(angle, [0, 0]);
            const coordsRotated = coordsScaled.map((coord) => {
                const rotated = rotatePoint(coord, coordsRotationMatrix);
                return [...rotated, coord[2]];
            });
            const inverseRotationMatrix = invertTransformMatrix(rotationMatrix);
            const boxCenter = [...getBoxCenter(box), 1];
            const originalBoxCenter = [
                dot(boxCenter, inverseRotationMatrix[0]),
                dot(boxCenter, inverseRotationMatrix[1])
            ];
            return coordsRotated.map((coord) => {
                return [
                    coord[0] + originalBoxCenter[0], coord[1] + originalBoxCenter[1],
                    coord[2]
                ];
            });
        }
        async estimateHand(image) {
            const useFreshBox = this.shouldUpdateRegionsOfInterest();
            if (useFreshBox === true) {
                const boundingBoxPrediction = await this.boundingBoxDetector.estimateHandBounds(image);
                if (boundingBoxPrediction === null) {
                    image.dispose();
                    this.regionsOfInterest = [];
                    return null;
                }
                this.updateRegionsOfInterest(boundingBoxPrediction, true);
                this.runsWithoutHandDetector = 0;
            }
            else {
                this.runsWithoutHandDetector++;
            }
            const currentBox = this.regionsOfInterest[0];
            const angle = computeRotation(currentBox.palmLandmarks[PALM_LANDMARKS_INDEX_OF_PALM_BASE], currentBox.palmLandmarks[PALM_LANDMARKS_INDEX_OF_MIDDLE_FINGER_BASE]);
            const palmCenter = getBoxCenter(currentBox);
            const palmCenterNormalized = [palmCenter[0] / image.shape[2], palmCenter[1] / image.shape[1]];
            let rotatedImage;
            const backend = tf.getBackend();
            if (backend.match('webgl')) {
                rotatedImage = rotate$1(image, angle, 0, palmCenterNormalized);
            }
            else if (backend === 'cpu' || backend === 'tensorflow') {
                rotatedImage = rotate(image, angle, 0, palmCenterNormalized);
            }
            else {
                throw new Error(`Handpose is not yet supported by the ${backend} ` +
                    `backend - rotation kernel is not defined.`);
            }
            const rotationMatrix = buildRotationMatrix(-angle, palmCenter);
            let box;
            if (useFreshBox === true) {
                box =
                    this.getBoxForPalmLandmarks(currentBox.palmLandmarks, rotationMatrix);
            }
            else {
                box = currentBox;
            }
            const croppedInput = cutBoxFromImageAndResize(box, rotatedImage, [this.meshWidth, this.meshHeight]);
            const handImage = croppedInput.div(255);
            croppedInput.dispose();
            rotatedImage.dispose();
            const savedWebglPackDepthwiseConvFlag = tf.env().get('WEBGL_PACK_DEPTHWISECONV');
            tf.env().set('WEBGL_PACK_DEPTHWISECONV', true);
            const [flag, keypoints] = this.meshDetector.predict(handImage);
            tf.env().set('WEBGL_PACK_DEPTHWISECONV', savedWebglPackDepthwiseConvFlag);
            handImage.dispose();
            const flagValue = flag.dataSync()[0];
            flag.dispose();
            if (flagValue < this.detectionConfidence) {
                keypoints.dispose();
                this.regionsOfInterest = [];
                return null;
            }
            const keypointsReshaped = tf.reshape(keypoints, [-1, 3]);
            const rawCoords = keypointsReshaped.arraySync();
            keypoints.dispose();
            keypointsReshaped.dispose();
            const coords = this.transformRawCoords(rawCoords, box, angle, rotationMatrix);
            const nextBoundingBox = this.getBoxForHandLandmarks(coords);
            this.updateRegionsOfInterest(nextBoundingBox, false);
            const result = {
                landmarks: coords,
                handInViewConfidence: flagValue,
                boundingBox: {
                    topLeft: nextBoundingBox.startPoint,
                    bottomRight: nextBoundingBox.endPoint
                }
            };
            return result;
        }
        calculateLandmarksBoundingBox(landmarks) {
            const xs = landmarks.map(d => d[0]);
            const ys = landmarks.map(d => d[1]);
            const startPoint = [Math.min(...xs), Math.min(...ys)];
            const endPoint = [Math.max(...xs), Math.max(...ys)];
            return { startPoint, endPoint };
        }
        updateRegionsOfInterest(box, forceUpdate) {
            if (forceUpdate) {
                this.regionsOfInterest = [box];
            }
            else {
                const previousBox = this.regionsOfInterest[0];
                let iou = 0;
                if (previousBox != null && previousBox.startPoint != null) {
                    const [boxStartX, boxStartY] = box.startPoint;
                    const [boxEndX, boxEndY] = box.endPoint;
                    const [previousBoxStartX, previousBoxStartY] = previousBox.startPoint;
                    const [previousBoxEndX, previousBoxEndY] = previousBox.endPoint;
                    const xStartMax = Math.max(boxStartX, previousBoxStartX);
                    const yStartMax = Math.max(boxStartY, previousBoxStartY);
                    const xEndMin = Math.min(boxEndX, previousBoxEndX);
                    const yEndMin = Math.min(boxEndY, previousBoxEndY);
                    const intersection = (xEndMin - xStartMax) * (yEndMin - yStartMax);
                    const boxArea = (boxEndX - boxStartX) * (boxEndY - boxStartY);
                    const previousBoxArea = (previousBoxEndX - previousBoxStartX) *
                        (previousBoxEndY - boxStartY);
                    iou = intersection / (boxArea + previousBoxArea - intersection);
                }
                this.regionsOfInterest[0] =
                    iou > UPDATE_REGION_OF_INTEREST_IOU_THRESHOLD ? previousBox : box;
            }
        }
        shouldUpdateRegionsOfInterest() {
            const roisCount = this.regionsOfInterest.length;
            return roisCount !== this.maxHandsNumber ||
                this.runsWithoutHandDetector >= this.maxContinuousChecks;
        }
    }

    async function loadHandDetectorModel() {
        const HANDDETECT_MODEL_PATH = (window._model_path_ || '') + '/models/hand-detect/model.json';
        return tfconv.loadGraphModel(HANDDETECT_MODEL_PATH, { fromTFHub: false });
    }
    const MESH_MODEL_INPUT_WIDTH = 256;
    const MESH_MODEL_INPUT_HEIGHT = 256;
    async function loadHandPoseModel() {
        const HANDPOSE_MODEL_PATH = (window._model_path_ || '') + '/models/hand-skeleton/model.json';
        return tfconv.loadGraphModel(HANDPOSE_MODEL_PATH, { fromTFHub: false });
    }
    async function loadAnchors() {
        return tf.util
            .fetch((window._model_path_ || '') + '/models/anchors.json')
            .then(d => d.json());
    }
    async function load({ maxContinuousChecks = Infinity, detectionConfidence = 0.8, iouThreshold = 0.3, scoreThreshold = 0.5 } = {}) {
        const [ANCHORS, handDetectorModel, handPoseModel] = await Promise.all([loadAnchors(), loadHandDetectorModel(), loadHandPoseModel()]);
        const detector = new HandDetector(handDetectorModel, MESH_MODEL_INPUT_WIDTH, MESH_MODEL_INPUT_HEIGHT, ANCHORS, iouThreshold, scoreThreshold);
        const pipeline = new HandPipeline(detector, handPoseModel, MESH_MODEL_INPUT_WIDTH, MESH_MODEL_INPUT_HEIGHT, maxContinuousChecks, detectionConfidence);
        const handpose = new HandPose(pipeline);
        return handpose;
    }
    function getInputTensorDimensions(input) {
        return input instanceof tf.Tensor ? [input.shape[0], input.shape[1]] :
            [input.height, input.width];
    }
    function flipHandHorizontal(prediction, width) {
        const { handInViewConfidence, landmarks, boundingBox } = prediction;
        return {
            handInViewConfidence,
            landmarks: landmarks.map((coord) => {
                return [width - 1 - coord[0], coord[1], coord[2]];
            }),
            boundingBox: {
                topLeft: [width - 1 - boundingBox.topLeft[0], boundingBox.topLeft[1]],
                bottomRight: [
                    width - 1 - boundingBox.bottomRight[0], boundingBox.bottomRight[1]
                ]
            }
        };
    }
    class HandPose {
        constructor(pipeline) {
            this.pipeline = pipeline;
        }
        static getAnnotations() {
            return MESH_ANNOTATIONS;
        }
        async estimateHands(input, flipHorizontal = false) {
            const [, width] = getInputTensorDimensions(input);
            const image = tf.tidy(() => {
                if (!(input instanceof tf.Tensor)) {
                    input = tf.browser.fromPixels(input);
                }
                return input.toFloat().expandDims(0);
            });
            const result = await this.pipeline.estimateHand(image);
            image.dispose();
            if (result === null) {
                return [];
            }
            let prediction = result;
            if (flipHorizontal === true) {
                prediction = flipHandHorizontal(result, width);
            }
            const annotations = {};
            for (const key of Object.keys(MESH_ANNOTATIONS)) {
                annotations[key] =
                    MESH_ANNOTATIONS[key].map(index => prediction.landmarks[index]);
            }
            return [{
                handInViewConfidence: prediction.handInViewConfidence,
                boundingBox: prediction.boundingBox,
                landmarks: prediction.landmarks,
                annotations
            }];
        }
    }

    exports.load = load;
    exports.HandPose = HandPose;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
