<template>
  <b-container
    :toast="{root: true}"
    fluid="sm"
    position="position-fixed"
    style="top:50px; left : -200px; z-index: 1100"
  />
</template>

<script>
/**
 * Toast Component
 *
 * This component shows a message in the dashboard, there are two ways to display a message:
 * From backend through websocket:
 * socket.emit("toast", <toastObject>);
 *
 * or from any vue component in frontend through eventBus:
 * this.eventBus.emit('toast', <toastObject>);
 *
 * Example toast object: (must have a message, others are optional)
 * {
 *  message: "This is an example!",
 *  title: "Example",
 *  variant: 'info', // 'primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'
 *  delay: 5000, //in ms
 *  }
 *
 *  More Information: https://cdmoro.github.io/bootstrap-vue-3/components/Toast.html#toasts-on-demand
 *
 *  @author Dennis Zyska
 */
import {useToast} from 'bootstrap-vue-3'

export default {
  name: "BasicToast",
  sockets: {
    toast: function (data) {
      this.makeToast(data);
    }
  },
  data() {
    return {
      toastCount: 0,
      toaster: null,
    }
  },
  mounted() {
    this.toaster = useToast();
    this.eventBus.on('toast', (data) => {
      this.makeToast(data);
    })
  },
  methods: {
    makeToast(data) {
      this.toaster.show(
          {
            title: (data.title !== undefined) ? data.title : "",
            body: data.message,

          },
          {
            variant: (data.variant !== undefined) ? data.variant : "info",
            delay: (data.delay !== undefined) ? data.delay : 5000,
          }
      );
    }
  }
}
</script>

<style scoped>

</style>