<template>
  <div id="wrapper" class="nav-container">
    <div id="sidebar-wrapper" class="bg-white">
      <div class="list-group list-group-flush">
        <span v-for="group in sidebarGroups">
          <h5 class="mb-1">{{ group.name }}</h5>
          <router-link :to="'/dashboard/' + element.path" v-for="element in sidebarElements[group.id]"
             class="list-group-item list-group-item-action list-group-item-light p-3">
            <span class="sidebar-icon">
              <LoadIcon :iconName="element.icon" :size="24" />
            </span>
          <div class="list-group-item-text">{{ element.name }}</div>
          </router-link>

        </span>
        <!--
                <a class="list-group-item list-group-item-action list-group-item-light p-3" href="#!">
                <span class="sidebar-icon">
                  <svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path
                      d="M29.71,15.29l-3-3h0l-10-10a1,1,0,0,0-1.42,0l-10,10h0l-3,3a1,1,0,0,0,0,1.42,1,1,0,0,0,1.42,0L5,15.41V29a1,1,0,0,0,1,1H26a1,1,0,0,0,1-1V15.41l1.29,1.3a1,1,0,0,0,1.42,0A1,1,0,0,0,29.71,15.29ZM25,28H7V13.41l9-9,9,9Z"/></svg>
                  </span>
                  <div class="list-group-item-text">Dashboard</div>
                </a>
                <a class="list-group-item list-group-item-action list-group-item-light p-3" href="#!">
                  <span class="sidebar-icon">
                  <svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path
                      d="M28.71,6.29l-6-6A1,1,0,0,0,22,0H6A3,3,0,0,0,3,3V29a3,3,0,0,0,3,3H26a3,3,0,0,0,3-3V7A1,1,0,0,0,28.71,6.29ZM27,29a1,1,0,0,1-1,1H6a1,1,0,0,1-1-1V3A1,1,0,0,1,6,2H21V6a2,2,0,0,0,2,2h4Z"/><rect
                      height="2" width="18" x="7" y="20"/><rect height="2" width="18" x="7" y="25"/><path
                      d="M7,12v4a1,1,0,0,0,1,1H24a1,1,0,0,0,1-1V12a1,1,0,0,0-1-1H8A1,1,0,0,0,7,12Zm2,1H23v2H9Z"/></svg>
                  </span>
                  <div class="list-group-item-text">Review</div>
                </a>
                <a class="list-group-item list-group-item-action list-group-item-light p-3" href="#!">
                  <span class="sidebar-icon">
                  <svg fill="currentColor" style="enable-background:new 0 0 50 50;" version="1.1" viewBox="0 0 50 50"
                       xml:space="preserve"
                       xmlns="http://www.w3.org/2000/svg"><path d="M0.586,30L20,49.414l29-29V1H29.586L0.586,30z M47,3v16.586l-27,27L3.414,30l27-27H47z"/><path
                      d="M40,14c2.206,0,4-1.794,4-4s-1.794-4-4-4s-4,1.794-4,4S37.794,14,40,14z M40,8c1.103,0,2,0.897,2,2s-0.897,2-2,2   s-2-0.897-2-2S38.897,8,40,8z"/></svg>
                  </span>
                  <div class="list-group-item-text">Tag Management</div>
                </a>-->
      </div>

      <div class="collapse-sidebar-container list-group-item-action list-group-item-light list-group-item"
           @click="toggleSidebar()">
        <span class="arrow-toggle sidebar-icon">
<svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path class="cls-1"
                                                                                      d="M16.88,15.53,7,5.66A1,1,0,0,0,5.59,7.07l9.06,9.06-8.8,8.8a1,1,0,0,0,0,1.41h0a1,1,0,0,0,1.42,0l9.61-9.61A.85.85,0,0,0,16.88,15.53Z"/><path
    class="cls-1"
    d="M26.46,15.53,16.58,5.66a1,1,0,0,0-1.41,1.41l9.06,9.06-8.8,8.8a1,1,0,0,0,0,1.41h0a1,1,0,0,0,1.41,0l9.62-9.61A.85.85,0,0,0,26.46,15.53Z"/></svg>
        </span>
        <div class="list-group-item-text">Collapse sidebar</div>
      </div>
    </div>
  </div>
</template>

<script>
/* Sidebar.vue - topbar and side toolbar  

This component provides both a topbar and left toggleable side toolbar.

Author: Carly Gettinger (cjgettinger@gmail.com)
Co-Author: Dennis Zyska (zyska@ukp...)
Source: left toggleable toolbar - simple sidebar found at https://github.com/StartBootstrap/startbootstrap-simple-sidebar
License for Simple Sidebar:
The MIT License (MIT)

Copyright (c) 2013-2022 Start Bootstrap LLC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

import LoadIcon from "../../icons/LoadIcon.vue";

export default {
  name: "Sidebar",
  components: {LoadIcon},
  computed: {
    sidebarElements() {
      return this.$store.getters['navigation/getSidebarElements'];
    },
    sidebarGroups() {
      return this.$store.getters['navigation/getSidebarGroups'];
    }
  },
  methods: {
    toggleSidebar() {
      document.body.classList.toggle('sb-sidenav-toggled');
    },


  },
  mounted() {
    console.log("Sidebar mounted");
    console.log(this.sidebarElements);
    console.log(this.sidebarGroups);
    document.body.classList.add('sidebar-exists');
  },
  beforeUnmount() {
    document.body.classList.remove('sidebar-exists');
  }
}

</script>

<style>

#wrapper {
  height: 100%;
}

#sidebar-wrapper {
  -webkit-transition: width .25s ease-out;
  -moz-transition: width .25s ease-out;
  -o-transition: width .25s ease-out;
  transition: width .25s ease-out;
  transition-delay: 0.1s;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  width: 13rem;
}

#sidebar-wrapper .list-group {
  border-bottom: 1px solid rgba(0, 0, 0, 0.125);
}

body.sb-sidenav-toggled #wrapper #sidebar-wrapper {
}

body.sb-sidenav-toggled .list-group-item-text {
  display: none;
}

@media (min-width: 768px) {
  #sidebar-wrapper {
    margin-left: 0;
  }

  #page-content-wrapper {
    min-width: 0;
    width: 100%;
  }

  body.sb-sidenav-toggled #wrapper #sidebar-wrapper {
    width: 50px;
  }
}

.list-group-item {
  display: flex !important;
  justify-content: flex-start;
  align-items: center;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-icon {
  height: 25px;
  width: 25px;
  flex-shrink: 0;
  margin-right: 12px;
  margin-left: -2px;
}

.arrow-toggle {
  transform: rotate(180deg);
}

body.sb-sidenav-toggled .arrow-toggle {
  transform: rotate(0deg);
}


</style>
