<template>
  <div id="sidebarContainer" class="col border mh-100 col-sm-auto g-0">
    <div id="hoverHotZone"></div>
    <div id="sidebar" class="collapse collapse-horizontal border-end d-flex flex-column">
      <div id="hotZone" class="hot-zone"></div>
      <div id="sidepane" ref="sidepane">
        <div id="spacer"></div>
          <SidebarHistory v-if="content === 'history'"/>
      </div>
    </div>
  </div>
</template>

<script>

import SidebarHistory from "@/components/editor/sidebar/History.vue";

/** Sidebar component of the Editor
 *
 * The Sidebar can show several card which can be clicked on and added to the Editor.
 *
 * @author Dennis Zyska
 */
export default {
  name: "EditorSidebar",
  components: {SidebarHistory},
  props: {
    content: {
      type: String,
      required: true,
      default: "history",
    },
  }
};
</script>

<style scoped>
#sidebar {
  height: 100%;
  width: 100%;
  position: relative;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  position: absolute;
}

#sidebar.is-active {
  transform: translateX(0);
}

#spacer {
  width: 400px;
  background-color: transparent;
}

#sidepane {
  padding-top: 5px;
  background-color: #e6e6e6;
  width: 100%;
  height: 100%;
  overflow-y: scroll;
}

#anno-list .list-group-i {
  border: none;
  background-color: transparent;
  margin-top: 4px;
  margin-left: 2px;
  margin-right: 2px;
}

#anno-list {
  list-style-type: none;
}

#addPageNote {
  padding-top: 1rem;
  text-align: center;
}

#addPageNote .btn {
  border: none;
  color: #575757;
}

#sidepane::-webkit-scrollbar {
  display: none;
}

.hot-zone {
  width: 3px;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  cursor: col-resize;
}

#sidebarContainer {
  position: relative;
  padding: 0;
  transition: width 0.3s ease;
  overflow-y: scroll;
}

#sidebarContainer.is-hidden {
  position: fixed;
  height: 100%;
  right: 0;
  width: 10px;
}

#sidebarContainer.is-hidden #hoverHotZone {
  display: block;
}

#sidebarContainer.is-dragging {
  transition: unset;
}

#sidebarContainer.is-fixed {
  position: fixed;
  right: 0;
}

#sidebarContainer.is-fixed .hot-zone {
  display: none;
}

#sidebarContainer::-webkit-scrollbar {
  display: none;
}

@media screen and (max-width: 900px) {
  #sidebarContainer {
    display: none;
  }
}
#hoverHotZone {
  position: fixed;
  height: 100%;
  width: 6px;
  top: 0;
  right: 0px;
  z-index: 999;
  display: none;
}
</style>
