const {dbGetDoc: getDoc} = require("../methods/document.js");
const db = require("../index");

describe("database document", () => {
    describe("get example document", () => {

        test('exists', async () => {
            const document = await getDoc(1);
            expect(document['name']).toBe("Showcase Document")
        });
    });

    afterAll(() => {
        db.sequelize.close();
    });
});