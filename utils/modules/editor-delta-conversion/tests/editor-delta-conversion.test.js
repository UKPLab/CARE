const { deltaToHtml, dbToDelta, deltaToDb, concatDeltas } = require('../index');
const Delta = require('quill-delta');
const fs = require('fs');
const path = require('path');

const testDataPath = path.join(__dirname, 'testData', 'data_1.json');
const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));

function runAllTestsInOne(data) {
    const { delta, html, dbEntries } = data;

    describe('Editor Delta Conversion Comprehensive Test', () => {
        test('should convert between Delta, HTML, and DB entries correctly', () => {
            // Test deltaToHtml function
            const convertedHtml = deltaToHtml(delta);
            expect(convertedHtml).toBe(html);

            // Test DbToDelta function
            const convertedDeltaArray = dbToDelta(dbEntries);
            expect(convertedDeltaArray).toEqual(new Delta(delta));

            // Test deltaToDb function
            const deltaOps = delta.ops;
            const convertedDbEntries = deltaToDb(deltaOps);
            expect(convertedDbEntries).toEqual(dbEntries);

            // Test concatDeltas function
            const deltas = [new Delta([{ insert: 'Hello, ' }]), new Delta([{ insert: 'world!', attributes: { bold: true } }])];
            const concatenatedDeltaForTest = concatDeltas(deltas);
            const expectedDelta = new Delta(delta);
            expect(concatenatedDeltaForTest).toEqual(expectedDelta);
        });
    });
}

runAllTestsInOne(testData);



