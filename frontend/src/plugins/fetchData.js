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
                    fetchDataId: null
                }
            },
            mounted() {
                if (this.$options.fetchData) {
                    if (this.$options.fetchData.length > 0) {
                        this.$options.fetchData.forEach((table) => {
                            if (typeof table !== "object") {
                                table = {table: table};
                            }
                            this.$socket.emit("subscribeAppData", table, (result) => {
                                if (result.success) {
                                    this.$data.fetchDataId = result.data;
                                }
                            });
                        });
                    }
                }
            },
            unmounted() {
                if (this.$data.fetchDataId) {
                    this.$socket.emit("unsubscribeAppData", this.$data.fetchDataId, (result) => {
                        this.eventBus.emit('toast', {
                            title: "Unsubscribe",
                            message: result.data,
                            variant: "danger"
                        });
                    });
                }
            }
        })

    }
}