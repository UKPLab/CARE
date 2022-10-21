const {setupTestSocket, tearDownTestSocket} = require("../db/tests/utils");
const db = require("../db/index");
const {DataTypes} = require("sequelize");

const Annotation = require("../db/models/annotation.js")(db.sequelize, DataTypes);

describe('Annotation Exporting Test', () => {
    /* START PREAMBLE */
    let app, httpServer, ioClient;

    beforeAll((done) => {
        [app, httpServer] = setupTestSocket((socket) => {
            ioClient = socket;
            done();
        });
    });

    afterEach(() => {
        //clear stuff if necessary
    });
    /* END PREAMBLE */

    test('expects the exported annotations', (done) => {
        const showcaseId = "8852a746-360e-4c31-add2-4d1c75bfb96d";
        const annoId = '271c5bf8-e6db-4ea0-b315-9f0a9482dd07';
        const targetText = "ters. The two approaches share thesame objective function during pre-training, wherethey use unidirec"
        const userName = "admin";
        const anno = {
            document_id: showcaseId,
            annotation: {
                target: [
                    {
                        selector: [
                            {"end": 6468, "type": "TextPositionSelector", "start": 6367},
                            {
                                "type": "TextQuoteSelector",
                                "exact": "ters. The two approaches share thesame objective function during pre-training, wherethey use unidirec",
                                "prefix": "ne-tuning all pre-trained parame",
                                "suffix": "tional language models to learng"
                            }
                        ]
                    }
                ]
            },
            user: 1,
            comment: null,
            draft: false,
            annotation_id: annoId,
            tags: JSON.parse('["Highlight"]')
        };

        ioClient.on("exportedAnnotations", (data) => {
            expect("success" in data && data["success"]);
            expect("csvs" in data && "docids" in data);

            const blobs = data["csvs"];
            const docids = data["docids"];

            // document present
            expect(docids).toContain(showcaseId);

            // csv present
            expect(blobs.length).toBe(1);

            // check text
            const csv = blobs[0];
            expect(csv).toContain(annoId);
            expect(csv).toContain(targetText)
            expect(csv).toContain(userName);

            done();
        });

        ioClient.emit("addAnnotation", anno);
        ioClient.on("newAnnotation", () => {
            ioClient.emit("exportAnnotations", [showcaseId]);
        });
    });

    afterAll(async () => {
        tearDownTestSocket(httpServer, ioClient);
        await Annotation.destroy({where: {hash: "8852a746-360e-4c31-add2-4d1c75bfb96d"}});
    });
})
