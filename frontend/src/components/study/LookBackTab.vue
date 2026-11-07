<template>
  <SidebarTemplate :icon="icon" :number="number" :title="title">
    <template #content>
      <LookBackPanel :step="step" :type="type" :label="label"/>
    </template>
  </SidebarTemplate>
</template>

<script>
/**
 * One sidebar tab that shows an earlier study step read-only, used by Study.vue in the sidebars of
 * Annotator and Editor steps. basic/Sidebar.vue reads a tab's icon, title and number from the props of the
 * first component in its slot, so this component takes them as its own props.
 *
 * @author Ilyas Mohammed
 */
import SidebarTemplate from "@/basic/sidebar/SidebarTemplate.vue";
import LookBackPanel from "@/components/study/LookBackPanel.vue";

export default {
  name: "LookBackTab",
  components: {SidebarTemplate, LookBackPanel},
  props: {
    icon: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    // The earlier step's number in the workflow, shown on the tab
    number: {
      type: Number,
      required: true,
    },
    step: {
      type: Object,
      required: true,
    },
    // "annotations" or "assessment"
    type: {
      type: String,
      required: true,
    },
    // The step's name, as on the workflow bar and on its document
    label: {
      type: String,
      required: true,
    },
  },
}
</script>
