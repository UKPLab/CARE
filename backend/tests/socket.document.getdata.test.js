/**
 * The Annotator treats the acknowledgement of documentGetData as "records loaded" (#507). So the
 * annotation and comment refreshes must be on the socket before it, also when resolving the creator
 * names takes a while. Runs the real createSocket, emit and getData on stubbed models.
 */
// Jest cannot load the ES module build of uuid, on which these two depend. Neither is used here.
jest.mock("uuid", () => ({v4: () => "id"}));
jest.mock("sequelize", () => ({Op: {or: "or", and: "and", in: "in", ne: "ne"}, Sequelize: {}, DataTypes: {}, Model: class {}}));

const DocumentSocket = require("../webserver/sockets/document.js");

const DOCUMENT_ID = 7;
const SESSION_ID = 42;
const STEP_ID = 9;

/**
 * Sends documentGetData through a socket whose creator name lookup finishes on later ticks.
 * @param {Object} data documentGetData payload
 * @param {Object} study The study of the session
 * @returns {Promise<string[]>} The events on the socket up to and including the acknowledgement
 */
async function sentEvents(data, study = {id: 1, collab: false}) {
    const events = [];
    const handlers = {};
    const emptyModel = {findAll: async () => [], getAllByKeyValues: async () => []};
    const instance = Object.create(DocumentSocket.prototype);
    Object.assign(instance, {
        socket: {on: (name, handler) => { handlers[name] = handler; }, emit: name => events.push(name)},
        logger: {error: () => {}},
        models: {
            document: {docTypes: {DOC_TYPE_HTML: 1}},
            study_session: {getById: async () => ({id: SESSION_ID, studyId: study.id}), getAllByKey: async () => [{id: SESSION_ID}]},
            study: {getById: async () => study},
            study_step: {getById: async () => ({id: STEP_ID, configuration: {}})},
            annotation: emptyModel, comment: emptyModel, comment_vote: emptyModel, tag: emptyModel,
        },
        validateDocument: async () => ({id: DOCUMENT_ID, type: 0}),
        notesForClosedStudiesOrNoSession: async () => ({annotations: [], comments: [], allComments: []}),
        getSocket: () => ({
            updateCreatorName: async rows => {
                await new Promise(resolve => setTimeout(resolve, 5));
                return rows;
            },
        }),
    });
    instance.createSocket("documentGetData", instance.getData, {}, false);

    await new Promise(resolve => handlers.documentGetData(data, response => {
        expect(response.success).toBe(true);
        events.push("ack");
        resolve();
    }));
    return [...events];
}

describe("documentGetData acknowledgement", () => {
    const expectRecordsBeforeAck = events => {
        const ack = events.indexOf("ack");
        expect(events.indexOf("annotationRefresh")).toBeGreaterThanOrEqual(0);
        expect(events.indexOf("annotationRefresh")).toBeLessThan(ack);
        expect(events.indexOf("commentRefresh")).toBeGreaterThanOrEqual(0);
        expect(events.indexOf("commentRefresh")).toBeLessThan(ack);
    };
    const inSession = {documentId: DOCUMENT_ID, studySessionId: SESSION_ID, studyStepId: STEP_ID};

    test("follows the record refreshes in a study session", async () => {
        expectRecordsBeforeAck(await sentEvents(inSession));
    });

    test("follows the record refreshes in a collaborative study", async () => {
        expectRecordsBeforeAck(await sentEvents(inSession, {id: 1, collab: true}));
    });

    test("follows the record refreshes without a study session", async () => {
        expectRecordsBeforeAck(await sentEvents({documentId: DOCUMENT_ID}));
    });
});
