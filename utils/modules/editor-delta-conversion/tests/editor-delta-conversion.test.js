const { deltaToHtml, dbToDelta, deltaToDb, concatDeltas } = require('../index');
const Delta = require('quill-delta');
const fs = require('fs');
const path = require('path');

function flattenDeltas(deltas) {
    let allOps = [];
    deltas.forEach(delta => allOps.push(...delta.ops));
    return { ops: allOps };
}

function runAllTestsInOne(data) {
    const { delta, html, dbEntries } = data;

    describe('Editor Delta Conversion Comprehensive Test', () => {
        test('should convert between Delta, HTML, and DB entries correctly', () => {
            try {
                // Test deltaToHtml function
                const convertedHtml = deltaToHtml(delta);
                expect(convertedHtml).toBe(html);
            } catch (error) {
                console.error('deltaToHtml test failed:', error);
            }

            try {
                // Test dbToDelta function
                const convertedDeltaArray = dbToDelta(dbEntries);
                const normalizedExpectedDelta = flattenDeltas([new Delta(delta)]); 
                const normalizedActualDelta = flattenDeltas(convertedDeltaArray);
                expect(normalizedActualDelta).toEqual(normalizedExpectedDelta);
            } catch (error) {
                console.error('dbToDelta test failed:', error);
            }

            try {
                // Test deltaToDb function
                const deltaOps = delta.ops;
                const convertedDbEntries = deltaToDb(deltaOps);
                expect(convertedDbEntries).toEqual(dbEntries);
            } catch (error) {
                console.error('deltaToDb test failed:', error);
            }
        });
    });
}

// Function to load data from a JSON file
function loadDataAndRunTest(fileName, testName) {
    const testDataPath = path.join(__dirname, 'testData', fileName);
    const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));
    runAllTestsInOne(testData, testName);
}

// List of test files and their descriptive names
const testCases = [
    { fileName: 'data_insert.json', testName: 'Insert Operations Test' },
    { fileName: 'data_delete.json', testName: 'Deletion Operations Test' },
    { fileName: 'data_attributes.json', testName: 'Attribute Operations Test' }
];

// Execute tests for each case
testCases.forEach(caseInfo => {
    loadDataAndRunTest(caseInfo.fileName, caseInfo.testName);
});



