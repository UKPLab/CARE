/**
 * This plugin will emit socket events on mounted to the backend
 * to make sure we get the latest data from the backend
 *
 * @author Dennis Zyska
 */
export default {
    install: (app, _options = {namespace: "table"}) => {
        app.mixin({
            // Only components that subscribe get the reactive list. This mixin is global, so a
            // plain data() here added a reactive object + array to every component instance.
            // subscriptionsPending counts subscriptions the server has not answered yet. The server
            // sends the table data before it answers, so 0 means "the data is in the store".
            // BasicTable reads it to show a loader instead of "Nothing here yet" meanwhile.
            data() {
                const tables = this.$options.subscribeTable;
                return tables ? {subscriptionIds: [], subscriptionsPending: tables.length} : {};
            },
            mounted() {
                if (this.$options.subscribeTable) {
                    if (this.$options.subscribeTable.length > 0) {
                        this.$options.subscribeTable.forEach((table) => {
                            if (typeof table !== "object") {
                                table = {table: table};
                            }
                            // timeout(): a lost answer must not leave the page "loading" forever.
                            this.$socket.timeout(30000).emit("subscribeAppData", table, (err, result) => {
                                this.$data.subscriptionsPending = Math.max(0, this.$data.subscriptionsPending - 1);
                                if (!err && result?.success) {
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