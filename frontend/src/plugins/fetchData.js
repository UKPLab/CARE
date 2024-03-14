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
                if (this.$options.fetchData) {
                    if (this.$options.fetchData.length > 0) {
                        this.$options.fetchData.forEach((table) => {
                            if (typeof table === "object") {
                                this.$socket.emit("appData", table);
                            } else {
                                this.$socket.emit("appData", {table: table});
                            }
                        });
                    }
                }
            }
        })

    }
}