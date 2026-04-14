/**
 * This plugin will emit socket events on mounted to the backend
 * to make sure we get the latest data from the backend
 *
 * @author Dennis Zyska
 */
export default {
    install: (app, _options = {namespace: "table"}) => {
        app.mixin({
            data() {
                return {
                    subscriptionIds: []
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
                                    this.$data.subscriptionIds.push(result.data);
                                }
                            });
                        });
                    }
                }
            },
            unmounted() {
                if (this.$data.subscriptionIds && this.$data.subscriptionIds.length > 0) {
                    this.$data.subscriptionIds.forEach((id) => {
                        this.$socket.emit("unsubscribeAppData", id, (result) => {
                            if (!result?.success) {
                                console.warn("unsubscribeAppData failed", { id, result });
                            }
                        });
                    });
                    this.$data.subscriptionIds = [];
                }
            }
        })

    }
}