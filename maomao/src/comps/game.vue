<template>
  <div class="fs">
    <div v-bind:class="{'header-badge': 1, show: !game_active}">
      <div class="logotext">MAOMAO™️ By EMERGE</div>
      <div class="smaller">Super AI Toy</div>
    </div>

    <div v-bind:class="{'game-badge': 1, orange: 1, active: 1, show: game_stage_prep}">
      <div class>{{pad(data.game.prep_countdown)}}</div>
      <div class="smaller">··请就位··</div>
    </div>

    <div v-bind:class="{'game-badge': 1, active: 1, show: game_stage_active}">
      <div class>{{pad(data.game.countdown)}}</div>
      <div class="smaller">! 已上机 !</div>
    </div>

    <div v-if="data.game.gameplay" v-bind:class="{'foot-note': 1, show: game_is_running}">
      <div class="large">{{data.game.gameplay.title}}</div>
      <div class="small" v-html="data.game.gameplay.desc"></div>
    </div>

    <div v-bind:class="{'lurrr': 1, show: !has_face_enhanced() && !game_active}">
      <div class="large">{{lurrr}}</div>
    </div>

    <div v-bind:class="{'large-note':1, 'show': data.visual.large_note}">
      <div class="large">{{data.visual.large_note}}</div>
    </div>
  </div>
</template>

<script>
import * as ao from "../libao_stripped";
import { loop } from "../libao_stripped";
import * as shared from "../shared";

let data = {
  data: shared.vueData,
  lurrr_sel: 0,
  lurrr_cur: -1,
  lurrr: "",
  lurrr_list: [
    "来康康",
    "过来试试",
    "抓下咯",
    "你真的会抓娃娃吗",
    "COME HERE",
    "凑近点嘛",
    "很好玩的",
    "来来来",
    "不要害羞"
  ]
};

var computed = { ...shared.vue_computed };
window._dbg = data;
var _last_shuffle = 0;
loop(() => {
  if (Math.random() > 0.95 && Date.now() - _last_shuffle > 4000) {
    data.lurrr_sel = Math.floor(Math.random() * data.lurrr_list.length);
    _last_shuffle = Date.now();
  }
  if (data.lurrr_cur != data.lurrr_sel) {
    if (data.lurrr.length > 1) {
      data.lurrr = data.lurrr.substring(0, data.lurrr.length - 1);
    } else {
      data.lurrr = "";
      data.lurrr_cur = data.lurrr_sel;
    }
  } else if (
    Math.random() > 0.9 &&
    data.lurrr != data.lurrr_list[data.lurrr_sel]
  ) {
    data.lurrr = data.lurrr_list[data.lurrr_sel].substring(
      0,
      data.lurrr.length + 1
    );
  }
});

function _pad(f) {
  return (f + "").length < 2 ? "0" + f : f;
}

export default {
  data: function() {
    return data;
  },
  methods: {
    pad: f => {
      var num1 = 0;
      var num2 = 0;
      var c = f;
      num2 = c % 60;
      num1 = Math.floor(c / 60);
      return _pad(num1) + ":" + _pad(num2);
    },
    has_face_enhanced: function() {
        return shared.state_checks.tracked("face")
    }
  },
  computed: computed
};
</script>

<style lang="less">
.large-note {
  font-size: 2.5rem;
  text-align: center;
  position: absolute;
  bottom: 120px;
  left: 75%;
  white-space: nowrap;
  transform: translate(-50%, 300px);
  transition: 0.7s all cubic-bezier(0.18, 0.89, 0.68, 1.42);
  /* width: 100%; */
  padding: 20px 50px;
  background: black;
  border-radius: 20px;
  &.show {
    transform: translate(-50%, 0px);
  }
}

@keyframes blink {
  0% {
    background: #8eff0030;
  }
  50% {
    background: #8eff00ff;
  }
  100% {
    background: #8eff0030;
  }
}

@keyframes blink-orange {
  0% {
    background: orange;
  }
  50% {
    background: transparent;
  }
  100% {
    background: orange;
  }
}

@keyframes alert-blink {
  0% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.5;
  }
}

.lurrr {
  font-size: 15rem;
  color: white;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: 0;
  text-shadow: 20px 17px 0px rgba(0, 0, 0, 0.22);
  right: 0;
  text-align: center;
  opacity: 0;
  transition: 0.2s all ease;
  &.show {
    opacity: 1;
  }
}

.alert {
  position: absolute;
  transition: all 0.2s ease-out;
  display: inline-block;
  border-radius: 10px;
  background: rgba(255, 50, 50, 255);
  color: white;
  animation: 0.8s infinite alert-blink;
  padding: 10px 30px;
  top: 800px;
  font-size: 2rem;
  left: 50%;
  transform: translate(-50%, 0) scale(0);
  &.show {
    transform: translate(-50%, 0) scale(1);
  }
}

.foot-note {
  position: absolute;
  top: 30px;
  right: 30px;
  /* transform: translate(-50%, 0); */
  font-size: 2.5rem;
  display: inline-block;
  padding: 30px 50px;
  background: #151515;
  transform-origin: 110% 0%;
  transform: rotate(120deg);
  transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  color: black;
  border-radius: 30px;
  border-top-right-radius: 0;
  border: 7px solid #ffffff;
  & > .large {
    font-size: 3rem;
    margin-bottom: 0.8rem;
    text-align: center;
    color: white;
  }
  & > .small {
    font-size: 0.8em;
    text-align: left;
    color: white;
  }
  &.show {
    transform: rotate(0);
  }
}

.game-badge,
.header-badge {
  display: inline-block;
  position: absolute;
  left: 50%;
  top: 0;
  transition: all 0.5s ease;
  transform: translate(-50%, -200px);
  padding: 10px 50px;
  background: #ff006a;
  font-size: 3rem;
  font-weight: bolder;
  border-radius: 100px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border: 15px solid #ffffff;
  border-top: none;
  box-shadow: 0px 0px 0 14px rgba(0, 0, 0, 0.59);
  color: #ffffff;
  .logotext {
    font-weight: bolder;
    -webkit-text-stroke: 2px white;
    -webkit-text-fill-color: white;
    margin: 5px;
    margin-bottom: 15px;
  }
  .smaller {
    font-size: 2rem;
    margin: 5px 10px;
    opacity: 0.8;
    font-weight: normal;
  }
  &.active {
    animation: 1s infinite blink;
    & > div {
      color: black;
    }
  }
  &.orange.active {
    animation: 0.3s infinite blink-orange;
  }

  &.show {
    transform: translate(-50%, 0);
  }
}

// .game-badge {
//   position: absolute;
//   left: 50%;
//   top: 900px;
//   transform: translate(-50%, -50%);
//   border-radius: 30px;
// }

.controller {
  position: absolute;
  left: 50%;
  top: 50%;
  overflow: visible;
}

.bigbtn {
  background: white;
  border-radius: 9999px;
  height: 350px;
  width: 350px;
  position: relative;
  overflow: visible;
  top: -350px;
}

.centered {
  overflow: visible;
  position: absolute;
  transform: translate(-50%, -50%);
}

.inline {
  display: inline-block;
}
.border {
  font-size: 50px;
  font-weight: 900;
  padding: 10px 30px;
  background: white;
  border-radius: 15px;
  color: #007eff;
  border: 6px solid #007eff;
  box-shadow: 0px 0px 0px 7px white, 0px 6px 13px 3px #000000bd;
}
* {
  text-align: center;
  color: white;
  font-weight: bolder;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
}
.fs {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
</style>