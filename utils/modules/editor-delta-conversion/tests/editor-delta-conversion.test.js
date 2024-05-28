const { convertToHtml, convert, deltaToDb } = require('../index');
const Delta = require('quill-delta');

describe('Editor Delta Conversion Tests', () => {

    /**
     * Test the convertToHtml function by converting a Delta object to HTML
     */
    describe('convertToHtml', () => {
        test('should convert Delta to HTML correctly', () => {
        const delta = new Delta([
            { insert: 'Hello, ' },
            { insert: 'world!', attributes: { bold: true } }
        ]);
        const html = convertToHtml(delta);
        expect(html).toBe('<p>Hello, <strong>world!</strong></p>');
        });
    });

    /**
     * Test the convert function by converting database entries to Delta
     */
    describe('convert', () => {
        test('should convert database entries to Delta correctly', () => {
        const dbEntries = [
            { operationType: 0, offset: 0, span: 0, text: 'Hello, ', attributes: null, createdAt: '2024-01-01T00:00:00Z' },
            { operationType: 0, offset: 7, span: 0, text: 'world!', attributes: { bold: true }, createdAt: '2024-01-02T00:00:00Z' }
        ];

        const delta = convert(dbEntries);
        const expectedDelta = new Delta([
            { retain: 0 },
            { insert: 'Hello, ', attributes: null },
            { retain: 7 },
            { insert: 'world!', attributes: { bold: true } }
        ]);

        expect(delta).toEqual(expectedDelta);
        });
    });

    /**
     * Test the deltaToDb function by converting Delta operations to database format
     */
    describe('deltaToDb', () => {
        test('should convert Delta ops to database format correctly', () => {
        const deltaOps = [
            { retain: 5 },
            { insert: 'Hello', attributes: { bold: true } },
            { delete: 3 }
        ];

        const dbEntries = deltaToDb(deltaOps);
        const expectedDbEntries = [
            { offset: 5, operationType: 0, span: 5, text: 'Hello', attributes: { bold: true } },
            { offset: 8, operationType: 1, span: 3, text: null, attributes: null }
        ];

        expect(dbEntries).toEqual(expectedDbEntries);
        });
    });
        
    afterAll(async () => {
        this.server.stop();
    });

})

