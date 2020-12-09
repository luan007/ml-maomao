<template>
  <div class="fs">
    <div v-for="i in VPADS">
      {{i}}
    </div>
  </div>
</template>

<script>
import * as shared from "../shared";
export default {
  data: function() {
    return {
      VPADS: shared.VPADS
    }
  }
};
</script>

<style lang="less" scoped>
.fs {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  color: white;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
</style>