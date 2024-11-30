/**
 * This plugin will emit socket events on mounted to the backend
 * to make sure we get the latest data from the backend
 *
 * @author Dennis Zyska
 */
export default {
    install: (app, options = {namespace: "table"}) => {
        app.mixin({
            data() {
                return {
                    subscriptionId: null
                }
            },
            mounted() {
                if (this.$options.subscribeTable) {
                    if (this.$options.subscribeTable.length > 0) {
                        this.$options.subscribeTable.forEach((table) => {
                            if (typeof table !== "object") {
                                table = {table: table};
                            }
                            this.$socket.emit("subscribeAppData", table, (result) => {
                                if (result.success) {
                                    this.$data.subscriptionId = result.data;
                                }
                            });
                        });
                    }
                }
            },
            unmounted() {
                if (this.$data.subscriptionId) {
                    this.$socket.emit("unsubscribeAppData", this.$data.subscriptionId, (result) => {
                        if (result.success) {
                            this.$data.subscriptionId = null;
                        }
                    });
                }
            }
        })

    }
}