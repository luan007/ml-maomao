import Vue from 'vue/dist/vue.esm.browser'

export function vueLoadComponents(q) {
    for (var i in q) {
        if (i == "default") continue;
        console.log("loading vue component  [", i, "]");
        Vue.component(i, q[i].default);
    }
}

export function vueSetup(el, data, opts) {
    opts = opts || {};
    opts.el = el;
    opts.data = data;
    return new Vue(opts);
}