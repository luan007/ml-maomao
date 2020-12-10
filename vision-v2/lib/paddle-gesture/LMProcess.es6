export default class LMProcess {
    constructor(result) {
        /*
        * result[0] :是否为手
        * result[1:43]: 手的21个关键点
        * result[43:49]: 几中手势分类，包含但不限于石头剪刀布，为了提升准确度
        * this.kp decode result得出的21个手指关键点，this.kp[8]为食指
        * this.conf 是否为手，越大，越可能是手
        */
        this.input_n = 1;
        this.input_h = 224;
        this.input_w = 224;
        this.input_c = 3;
        this.class_dim = 6;
        this.points_num = 1;
        this.result = result;
    }
    sigm(value) {
        return 1.0 / (1.0 + Math.exp(0.0 - value));
    }
    decodeConf() {
        this.conf = this.sigm(this.result[0]);
    }
    decodeKp() {
        // 21个关键点，下标1开始
        let offset = 1;
        let result = this.result;
        this.kp = [];
        for (let i = 0; i < this.points_num; i++) {
            let arr = [];
            arr.push((result[offset + i * 2] + 0.5) * this.input_h);
            arr.push((result[offset + i * 2 + 1] + 0.5) * this.input_h);
            this.kp.push(arr);
        }
        this.forefinger = this.kp[0];
    }
    softMax() {
        let max = 0;
        let sum = 0;
        let offset = 2;
        let class_dim = this.class_dim = 7;
        let result = this.result;
        let output_softmax = new Array(7).fill(null);

        for (let i = 0; i < class_dim; i++) {
            if (max < result[i + offset])
                max = result[i + offset];
        }

        for (let i = 0; i < class_dim; i++) {
            output_softmax[i] = Math.exp(result[i + offset] - max);
            sum += output_softmax[i];
        }

        for (let i = 0; i < class_dim; i++) {
            output_softmax[i] /= sum;
        }

        this.output_softmax = output_softmax;
    }
    output() {
        this.decodeKp();
        this.softMax();

        let label_index = 0;
        let max_pro = this.output_softmax[0];
        for (let i = 1; i < this.class_dim; i++) {
            if (max_pro < this.output_softmax[i]) {
                label_index = i;
                max_pro = this.output_softmax[i];
            }
        }
        // 最后一位：有无手
        if (label_index != 0 && label_index != this.class_dim - 1 && max_pro > 0.93) {
            let ges = ['', 'palm', 'yeah', 'fist', 'point', 'ok'];
            this.type = ges[label_index];
        } else {
            this.type = '';
        }
    }
}
