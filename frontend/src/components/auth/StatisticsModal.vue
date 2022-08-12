<template>
  <Modal ref="stats" lg>
    <template v-slot:title>Statistics</template>
    <template v-slot:body >
      <div >
       Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam purus enim, tempor a pulvinar sit amet, mattis ut ex. Maecenas vehicula a justo non auctor. Maecenas porta eu libero commodo cursus. Aliquam augue elit, commodo vitae turpis non, cursus pharetra leo. Vestibulum ut nisl lacinia, iaculis urna at, elementum mi. Nam dapibus elit nec ultrices semper. Proin finibus nisl neque, id maximus velit fringilla in. Aliquam volutpat dui eget elit ultrices venenatis. Mauris ullamcorper ipsum ligula, auctor pharetra ex iaculis et. Donec ac neque eu nibh consectetur bibendum eget eu mi. Integer a ipsum sit amet orci ultricies blandit. Pellentesque tincidunt finibus blandit. Ut et erat lobortis, ultricies erat vitae, porttitor sem. Donec sagittis scelerisque purus, nec viverra felis dictum ut. Praesent sodales maximus pulvinar. Mauris id mollis ante.

Suspendisse viverra augue tortor, elementum rutrum magna pretium vel. Nulla iaculis facilisis tellus. Cras commodo ex diam, eget malesuada turpis ultrices ac. Nulla vulputate orci eget volutpat maximus. Fusce elementum mollis ipsum a interdum. Donec sit amet rutrum arcu. Sed feugiat nec velit non imperdiet. Integer at sapien sed justo consectetur egestas vel vitae sapien. Praesent ullamcorper nisi sit amet metus rutrum, nec tincidunt felis sollicitudin. Etiam eget mauris consequat, porttitor augue nec, egestas urna. Suspendisse ut nisi eget enim egestas dictum nec rhoncus sem. Nam vulputate ullamcorper facilisis. Nulla facilisi.

Mauris lacus nibh, suscipit non laoreet nec, sodales nec orci. Etiam hendrerit sit amet leo id tincidunt. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Sed varius felis sodales egestas condimentum. Quisque posuere purus a nulla fringilla, eget pellentesque nisl accumsan. Suspendisse vehicula vulputate lectus, ac pellentesque neque maximus a. Nam quis lacus maximus quam pulvinar egestas in ut lorem. Ut ullamcorper magna sit amet ultrices iaculis. Donec sit amet lorem posuere, scelerisque lectus vitae, auctor nibh. Nam pellentesque vehicula justo at semper. Fusce imperdiet viverra quam, at tempor sapien commodo eget. Vivamus sagittis urna non vulputate sagittis. Aliquam fermentum ex urna. Vestibulum nec iaculis tellus, quis sollicitudin nibh. Maecenas eget nisi scelerisque, scelerisque ex sodales, facilisis turpis.

Nunc facilisis, nulla malesuada interdum placerat, tortor lacus tempus massa, posuere varius erat odio sit amet libero. Morbi ex justo, ultricies non tincidunt eget, cursus ac nulla. Etiam consectetur mi nec felis pulvinar dictum. Aliquam at viverra lacus. Duis lacinia, augue ac venenatis accumsan, enim nibh feugiat nisi, non luctus lectus purus in justo. Nam sagittis, mauris ac ultrices porta, ligula lacus cursus metus, eget mattis dolor metus vel tellus. Quisque consectetur metus non fringilla eleifend. Maecenas elementum fringilla maximus. Nunc ut feugiat metus. Nullam posuere laoreet mauris nec dignissim. Maecenas pulvinar justo a risus pharetra laoreet.

Nullam rhoncus, dolor ut sagittis semper, nisl metus tempus ante, vulputate ultrices risus leo aliquam nisl. Phasellus urna justo, elementum at cursus mattis, lobortis quis ligula. Suspendisse ullamcorper magna ac faucibus sagittis. Duis nec odio a lacus gravida mollis. Curabitur interdum justo quis interdum lacinia. Donec aliquam dui at ante efficitur tincidunt. Duis at sem scelerisque, egestas libero ac, posuere velit. Curabitur urna est, semper eu sodales ac, placerat in nisl. Integer dignissim venenatis nulla, suscipit vehicula tortor ultrices id. Praesent accumsan felis in metus hendrerit fermentum. Morbi non aliquam ex. In aliquet, sem sit amet vulputate sollicitudin, dui ante scelerisque magna, id maximus eros orci sed ex. Praesent felis diam, facilisis nec dignissim consequat, sodales nec mi. Ut hendrerit purus vel nibh iaculis pellentesque. Donec tempor tincidunt felis, et maximus felis.
      </div>
    </template>
    <template v-slot:footer>
      <button class="btn btn-secondary" type="button" @click="cancel">Close</button>
    </template>
  </Modal>
</template>

<script>
import Modal from "../dashboard/modals/Modal.vue";
export default {
  name: "StatisticsModal",
  components: {Modal},
  props: {
  },
  methods: {
    open() {
      this.$refs.stats.openModal();
    },
    cancel() {
      this.$refs.stats.closeModal();
    },
  }
}
</script>

<style scoped>

</style>