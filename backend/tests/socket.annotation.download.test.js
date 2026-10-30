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

        await expect(socket.getDownloadableAnnotations(5)).resolves.toMatchObject({annotations, hasFullAccess: true});
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

        expect(result.annotations.map(annotation => annotation.id)).toEqual([1, 2]);
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

        expect(result.annotations.map(annotation => annotation.id)).toEqual([1, 2]);
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

        expect(result.annotations.map(annotation => annotation.id)).toEqual([1, 4, 5]);
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

        expect(result.annotations.map(annotation => annotation.id)).toEqual([1, 2, 3]);
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

        expect(result.annotations.map(annotation => annotation.id)).toEqual([1]);
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

    test.each([false, true])("keeps other authors' no-session annotations (document used in a study: %s)", async inStudy => {
        const socket = createAnnotationSocket({
            annotations: [
                {id: 1, userId: 20, studySessionId: null},
                {id: 2, userId: 20, studySessionId: 101},
                {id: 3, userId: 10, studySessionId: 100},
            ],
            studySteps: inStudy ? [{studyId: 1}] : [],
            studies: [{id: 1, collab: false, closed: null}],
            studySessions: [{id: 101, studyId: 1, userId: 20}],
        });

        const download = await socket.getDownloadableAnnotations(5);

        expect(download.annotations.map(annotation => annotation.id)).toEqual([1, 3]);
    });

    test.each([
        {label: "open non-collaborative study", collab: false, closed: null, fullAccess: false, expected: [11, 14]},
        {label: "closed study", collab: false, closed: "2026-10-01", fullAccess: false, expected: [11, 12, 13, 14, 15, 16]},
        {label: "open collaborative study", collab: true, closed: null, fullAccess: false, expected: [11, 12, 13, 14, 15, 16]},
        {label: "full access", collab: false, closed: null, fullAccess: true, expected: [11, 12, 13, 14, 19, 20, 15, 16]},
    ])("checks individual comments and prunes hidden branches: $label", async ({collab, closed, fullAccess, expected}) => {
        const annotations = [{id: 1, userId: 10, studySessionId: null}];
        const socket = createAnnotationSocket({
            annotations, fullAccess,
            studySteps: [{studyId: 1}],
            studies: [{id: 1, userId: 30, collab, closed}],
            studySessions: [
                {id: 100, studyId: 1, userId: 10},
                {id: 101, studyId: 1, userId: 20},
            ],
        });
        const comments = [
            {id: 11, userId: 30, annotationId: 1, parentCommentId: null, studySessionId: null},
            {id: 12, userId: 20, annotationId: null, parentCommentId: 11, studySessionId: 101, anonymous: true},
            // Even an own reply carrying annotationId must not bypass a hidden parent.
            {id: 13, userId: 10, annotationId: 1, parentCommentId: 12, studySessionId: 100},
            {id: 14, userId: 10, annotationId: null, parentCommentId: 11, studySessionId: 100},
            {id: 15, userId: 20, annotationId: 1, parentCommentId: null, studySessionId: 101},
            {id: 16, userId: 30, annotationId: null, parentCommentId: 15, studySessionId: null},
            // Document-level threads and comments on excluded annotations remain separate.
            {id: 17, userId: 10, annotationId: null, parentCommentId: null, studySessionId: null},
            {id: 18, userId: 10, annotationId: 2, parentCommentId: null, studySessionId: null},
            // An unrelated study is not made visible just because its reply is on a shared annotation.
            {id: 19, userId: 20, annotationId: null, parentCommentId: 11, studySessionId: 201},
            {id: 20, userId: 10, annotationId: null, parentCommentId: 19, studySessionId: null},
        ];
        const download = await socket.getDownloadableAnnotations(5);
        const threads = socket.getDownloadableCommentsByAnnotation(comments, download.annotations, download);

        expect(threads.get(1).map(comment => comment.id)).toEqual(expected);
        expect(socket.models.study_session.getAllByKeyValues).toHaveBeenCalledTimes(fullAccess ? 0 : 1);
    });

    test("PDF payload excludes open-study replies and their authors before metadata is loaded", async () => {
        const socket = createAnnotationSocket({
            annotations: [{id: 1, userId: 10, studySessionId: null}],
            studySteps: [{studyId: 1}],
            studies: [{id: 1, userId: 10, collab: false, closed: null}],
            studySessions: [{id: 101, studyId: 1, userId: 20}],
        });
        socket.getSocket = jest.fn().mockReturnValue({
            validateDocument: jest.fn().mockResolvedValue({id: 5, hash: "test-document"}),
        });
        socket.models.comment = {getAllByKey: jest.fn().mockResolvedValue([
            {id: 11, userId: 10, annotationId: 1, parentCommentId: null, studySessionId: null},
            {id: 12, userId: 20, annotationId: null, parentCommentId: 11, studySessionId: 101},
            {id: 13, userId: 10, annotationId: null, parentCommentId: 12, studySessionId: null},
        ])};
        socket.models.user = {getAllByKeyValues: jest.fn().mockResolvedValue([{id: 10, userName: "Owner"}])};
        socket.models.tag = {getAllByKeyValues: jest.fn()};
        const embeddAnnotations = jest.fn().mockResolvedValue(Buffer.from("embedded pdf"));
        socket.server = {rpcs: {PDFRPC: {embeddAnnotations}}};
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from("pdf"));

        await socket.embedAnnotationsForDocument({documentId: 5}, {});

        const payload = embeddAnnotations.mock.calls[0][0];
        expect(payload.annotations[0].comments.map(comment => comment.id)).toEqual([11]);
        expect(socket.models.user.getAllByKeyValues).toHaveBeenCalledWith("id", [10]);
        expect(socket.models.study_session.getAllByKeyValues).toHaveBeenCalledTimes(1);
    });

    test("missing annotation and comment authors fall back to Unknown user while anonymous authors stay anonymous", async () => {
        const socket = createAnnotationSocket();
        socket.models.user = {getAllByKeyValues: jest.fn().mockResolvedValue([])};
        socket.models.tag = {getAllByKeyValues: jest.fn()};
        const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
        const annotation = {id: 1, userId: 20};
        const comments = [
            {id: 11, userId: 30},
            {id: 12, userId: 40, anonymous: true},
        ];

        const result = await socket.addAnnotationMetadata([annotation], new Map([[1, comments]]));

        expect(result[0].username).toBe("Unknown user");
        expect(result[0].comments.map(comment => comment.username)).toEqual(["Unknown user", "Anonymous"]);
        expect(socket.models.user.getAllByKeyValues).toHaveBeenCalledWith("id", [20, 30]);
        expect(warning).toHaveBeenCalledTimes(2);
    });

    test("batches metadata queries and preserves the author of each permitted reply", async () => {
        const socket = createAnnotationSocket();
        const firstAnnotation = {id: 1, userId: 10, tagId: 3, anonymous: false, studySessionId: null};
        const secondAnnotation = {id: 2, userId: 20, tagId: 4, anonymous: false, studySessionId: null};
        const rootComment = {
            id: 11,
            userId: 10,
            annotationId: 1,
            parentCommentId: null,
            text: "My comment",
            studySessionId: null,
        };
        const reply = {
            id: 12,
            userId: 20,
            annotationId: null,
            parentCommentId: 11,
            text: "Reviewer's reply",
            studySessionId: null,
        };
        const anonymousReply = {
            id: 13,
            userId: 30,
            annotationId: null,
            parentCommentId: 12,
            anonymous: true,
            text: "Anonymous reply",
            studySessionId: null,
        };
        const secondRootComment = {
            id: 21,
            userId: 20,
            annotationId: 2,
            parentCommentId: null,
            text: "Second comment",
            studySessionId: null,
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
        socket.models.annotation.getAllByKey.mockResolvedValue([firstAnnotation, secondAnnotation]);
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
