/**
 * This plugin will emit socket events on mounted to the backend
 * to make sure we get the latest data from the backend
 *
 * @author Dennis Zyska
 */
export default {
    install: (app, options = {namespace: "table"}) => {
        app.mixin({
            mounted() {
                if (this.$options.fetchData && this.$options.fetchData.length > 0) {
                    this.$options.fetchData.forEach((table) => {
                        this.$socket.emit("appData", {table: table});
                    });
                }
            }
        })

    }
}