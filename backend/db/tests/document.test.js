const {dbGetDoc: getDoc} = require("../methods/document.js");
const db = require("../index");

describe("database document", () => {
    describe("get example document", () => {

        test('exists', async () => {
            const document = await getDoc("8852a746-360e-4c31-add2-4d1c75bfb96d");
            expect(document['name']).toBe("Showcase Document")
        });
    });

    afterAll(() => {
        db.sequelize.close();
    });
});