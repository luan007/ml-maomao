import * as ao from "./libao_stripped/index";
import "./main.less";
import "./guibase"
import * as shared from "./shared.js";
import * as vue_comps from "./comps/*.vue";
import vue from "vue/dist/vue";

for(var i in vue_comps) {
    if(i == 'default') { continue; }
    vue.component(i, vue_comps[i].default);
}

new vue({
    el: "#app",
    data: {
        vpads: shared.VPADS
    }
});