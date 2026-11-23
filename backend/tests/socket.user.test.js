const {once} = require("node:events");
const Server = require("../webserver/Server.js");
const {getSocketClient} = require("./utils.js");

describe("Test Websockets - User", () => {
    let clientSocket;

    beforeAll(async () => {
        this.server = new Server();
        this.server.start(3111);
    });

    beforeEach(async () => {
        clientSocket = await getSocketClient(this.server,3111, process.env.ADMIN_EMAIL, process.env.ADMIN_PWD);
        await once(clientSocket, "ready", {signal: AbortSignal.timeout(5000)});
    });

    test("Get User Data", (done) => {
        clientSocket.on("userByRole", (data) => {
            expect(data.success).toBe(true);
            expect(data.users.length).toBeGreaterThan(0);
            done();
        })
        clientSocket.emit("userGetByRole", {role: "all"});
    });

    test("refreshes an affected user's open socket after a role right is revoked", async () => {
        const right = "frontend.dashboard.workflows.view";
        const role = await this.server.db.models.user_role.findOne({where: {name: "guest"}});
        const guest = await getSocketClient(this.server, 3111, process.env.GUEST_EMAIL, process.env.GUEST_PWD);
        const waitForGuest = event => once(guest, event, {signal: AbortSignal.timeout(5000)});
        const changeRights = changes => clientSocket.timeout(5000).emitWithAck(
            "userAssignRoleRights", {roleId: role.id, ...changes}
        );
        try {
            await waitForGuest("ready");
            const initial = waitForGuest("appUser");
            guest.emit("appInit", {});
            const [before] = await initial;
            expect(before.isAdmin).toBe(false);
            expect(before.rights).toContain(right);

            const [[after], result] = await Promise.all([
                waitForGuest("appUser"),
                changeRights({deletedRights: [right]}),
            ]);
            expect(result.success).toBe(true);
            expect(after.id).toBe(before.id);
            expect(after.rights).not.toContain(right);
        } finally {
            guest.disconnect();
            const mapping = await this.server.db.models.role_right_matching.findOne({
                where: {userRoleId: role.id, userRightName: right, deleted: false},
            });
            if (!mapping) {
                expect((await changeRights({newRights: [right]})).success).toBe(true);
            }
        }
    });

    afterEach(() => {
        if (clientSocket.connected) {
            clientSocket.disconnect();
        }
    });

    afterAll(async () => {
        await this.server.stop();
    });

});