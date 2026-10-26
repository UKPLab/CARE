jest.mock("../webserver/Socket.js", () => class Socket {});

const fs = require("fs");
const AnnotationSocket = require("../webserver/sockets/annotation.js");

function createAnnotationSocket({
    userId = 10,
    fullAccess = false,
    annotations = [],
    studySteps = [],
    studies = [],
    studySessions = [],
} = {}) {
    const socket = Object.create(AnnotationSocket.prototype);
    socket.userId = userId;
    socket.hasAccess = jest.fn().mockResolvedValue(fullAccess);
    socket.models = {
        annotation: {
            getAllByKey: jest.fn().mockResolvedValue(annotations),
        },
        study_step: {
            getAllByKey: jest.fn().mockResolvedValue(studySteps),
        },
        study: {
            getAllByKeyValues: jest.fn().mockResolvedValue(studies),
        },
        study_session: {
            getAllByKeyValues: jest.fn().mockResolvedValue(studySessions),
        },
    };
    return socket;
}

describe("Annotation PDF download visibility", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("users with full study access receive all document annotations", async () => {
        const annotations = [
            {id: 1, userId: 10, studySessionId: null},
            {id: 2, userId: 20, studySessionId: 200},
        ];
        const socket = createAnnotationSocket({fullAccess: true, annotations});

        await expect(socket.getDownloadableAnnotations(5)).resolves.toEqual(annotations);
        expect(socket.models.study_step.getAllByKey).not.toHaveBeenCalled();
    });

    test("a participant receives only their own annotations from an open non-collaborative study", async () => {
        const socket = createAnnotationSocket({
            annotations: [
                {id: 1, userId: "10", studySessionId: null},
                {id: 2, userId: 10, studySessionId: 100},
                {id: 3, userId: 20, studySessionId: 101},
            ],
            studySteps: [{id: 1, studyId: 1}],
            studies: [{id: 1, collab: false, closed: null}],
            studySessions: [
                {id: 100, studyId: 1, userId: 10},
                {id: 101, studyId: 1, userId: 20},
            ],
        });

        const result = await socket.getDownloadableAnnotations(5);

        expect(result.map(annotation => annotation.id)).toEqual([1, 2]);
    });

    test("a participant receives all sessions from an open collaborative study they joined", async () => {
        const socket = createAnnotationSocket({
            annotations: [
                {id: 1, userId: 10, studySessionId: 100},
                {id: 2, userId: 20, studySessionId: 101},
                {id: 3, userId: 30, studySessionId: 201},
            ],
            studySteps: [
                {id: 1, studyId: 1},
                {id: 2, studyId: 2},
            ],
            studies: [
                {id: 1, collab: true, closed: null},
                {id: 2, collab: true, closed: null},
            ],
            studySessions: [
                {id: 100, studyId: 1, userId: 10},
                {id: 101, studyId: 1, userId: 20},
                {id: 201, studyId: 2, userId: 30},
            ],
        });

        const result = await socket.getDownloadableAnnotations(5);

        expect(result.map(annotation => annotation.id)).toEqual([1, 2]);
    });

    test("a participant receives all sessions only from closed studies they joined", async () => {
        const socket = createAnnotationSocket({
            annotations: [
                {id: 1, userId: 20, studySessionId: 101, studyStepId: 11},
                {id: 2, userId: 30, studySessionId: 201},
                {id: 3, userId: 40, studySessionId: 301},
                {id: 4, userId: 20, studySessionId: 101, studyStepId: 12},
                {id: 5, userId: 20, studySessionId: null, studyStepId: null},
            ],
            studySteps: [
                {id: 1, studyId: 1},
                {id: 2, studyId: 2},
                {id: 3, studyId: 3},
            ],
            studies: [
                {id: 1, collab: false, closed: "2026-10-01T12:00:00.000Z"},
                {id: 2, collab: false, closed: "2026-10-01T12:00:00.000Z"},
                {id: 3, collab: false, closed: null},
            ],
            studySessions: [
                {id: 100, studyId: 1, userId: 10},
                {id: 101, studyId: 1, userId: 20},
                {id: 201, studyId: 2, userId: 30},
                {id: 300, studyId: 3, userId: 10},
                {id: 301, studyId: 3, userId: 40},
            ],
        });

        const result = await socket.getDownloadableAnnotations(5);

        expect(result.map(annotation => annotation.id)).toEqual([1, 4]);
    });

    test("a study owner receives reviewer annotations after the study is closed", async () => {
        const socket = createAnnotationSocket({
            annotations: [
                {id: 1, userId: 10, studySessionId: null},
                {id: 2, userId: 20, studySessionId: 101},
                {id: 3, userId: 30, studySessionId: 102},
            ],
            studySteps: [{id: 1, studyId: 1}],
            studies: [{id: 1, userId: 10, collab: false, closed: "2026-10-01T12:00:00.000Z"}],
            studySessions: [
                {id: 101, studyId: 1, userId: 20},
                {id: 102, studyId: 1, userId: 30},
            ],
        });

        const result = await socket.getDownloadableAnnotations(5);

        expect(result.map(annotation => annotation.id)).toEqual([1, 2, 3]);
    });

    test("a study owner does not receive reviewer annotations before a non-collaborative study is closed", async () => {
        const socket = createAnnotationSocket({
            annotations: [
                {id: 1, userId: 10, studySessionId: null},
                {id: 2, userId: 20, studySessionId: 101},
            ],
            studySteps: [{id: 1, studyId: 1}],
            studies: [{id: 1, userId: 10, collab: false, closed: null}],
            studySessions: [{id: 101, studyId: 1, userId: 20}],
        });

        const result = await socket.getDownloadableAnnotations(5);

        expect(result.map(annotation => annotation.id)).toEqual([1]);
    });

    test("document access is validated before annotations are queried", async () => {
        const socket = createAnnotationSocket();
        const accessError = new Error("access denied");
        const validateDocument = jest.fn().mockRejectedValue(accessError);
        socket.getSocket = jest.fn().mockReturnValue({validateDocument});

        await expect(socket.embedAnnotationsForDocument({documentId: 5}, {})).rejects.toBe(accessError);
        expect(validateDocument).toHaveBeenCalledWith(5, 'id', true);
        expect(socket.models.annotation.getAllByKey).not.toHaveBeenCalled();
    });

    test("batches metadata queries and preserves the author of each permitted reply", async () => {
        const socket = createAnnotationSocket();
        const firstAnnotation = {id: 1, userId: 10, tagId: 3, anonymous: false};
        const secondAnnotation = {id: 2, userId: 20, tagId: 4, anonymous: false};
        const rootComment = {
            id: 11,
            userId: 10,
            annotationId: 1,
            parentCommentId: null,
            text: "My comment",
        };
        const reply = {
            id: 12,
            userId: 20,
            annotationId: null,
            parentCommentId: 11,
            text: "Reviewer's reply",
        };
        const anonymousReply = {
            id: 13,
            userId: 30,
            annotationId: null,
            parentCommentId: 12,
            anonymous: true,
            text: "Anonymous reply",
        };
        const secondRootComment = {
            id: 21,
            userId: 20,
            annotationId: 2,
            parentCommentId: null,
            text: "Second comment",
        };
        const unrelatedComment = {
            id: 31,
            userId: 40,
            annotationId: 3,
            parentCommentId: null,
            text: "Other annotation",
        };
        const documentNote = {
            id: 41,
            userId: 50,
            annotationId: null,
            parentCommentId: null,
            text: "Document note",
        };
        const pdf = Buffer.from("pdf");
        const embeddedPdf = Buffer.from("embedded pdf");
        const document = {id: 5, hash: "document-hash"};
        const embeddAnnotations = jest.fn().mockResolvedValue(embeddedPdf);
        socket.getSocket = jest.fn().mockReturnValue({
            validateDocument: jest.fn().mockResolvedValue(document),
        });
        socket.getDownloadableAnnotations = jest.fn().mockResolvedValue([firstAnnotation, secondAnnotation]);
        socket.models.comment = {
            getAllByKey: jest.fn().mockResolvedValue([
                rootComment,
                reply,
                anonymousReply,
                secondRootComment,
                unrelatedComment,
                documentNote,
            ]),
        };
        socket.models.tag = {
            getAllByKeyValues: jest.fn().mockResolvedValue([
                {id: 3, name: "Issue"},
                {id: 4, name: "Strength"},
            ]),
        };
        socket.models.user = {
            getAllByKeyValues: jest.fn().mockResolvedValue([
                {id: 10, userName: "participant"},
                {id: 20, userName: "reviewer"},
            ]),
        };
        socket.server = {rpcs: {PDFRPC: {embeddAnnotations}}};
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "readFileSync").mockReturnValue(pdf);

        const result = await socket.embedAnnotationsForDocument({documentId: 5}, {});

        expect(socket.models.tag.getAllByKeyValues).toHaveBeenCalledTimes(1);
        expect(socket.models.tag.getAllByKeyValues).toHaveBeenCalledWith('id', [3, 4]);
        expect(socket.models.user.getAllByKeyValues).toHaveBeenCalledTimes(1);
        expect(socket.models.user.getAllByKeyValues).toHaveBeenCalledWith('id', [10, 20]);
        expect(embeddAnnotations).toHaveBeenCalledWith({
            file: pdf,
            annotations: [
                {
                    ...firstAnnotation,
                    tag: "Issue",
                    username: "participant",
                    comments: [
                        {...rootComment, username: "participant"},
                        {...reply, username: "reviewer"},
                        {...anonymousReply, username: "Anonymous"},
                    ],
                },
                {
                    ...secondAnnotation,
                    tag: "Strength",
                    username: "reviewer",
                    comments: [{...secondRootComment, username: "reviewer"}],
                },
            ],
            document,
        });
        expect(result).toEqual({documentId: 5, file: embeddedPdf, hash: "document-hash"});
    });
});
