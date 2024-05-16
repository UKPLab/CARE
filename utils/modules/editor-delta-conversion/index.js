const Delta = require('quill-delta');
const {QuillDeltaToHtmlConverter} = require('quill-delta-to-html');

exports.convertToHtml = function (delta) {
    const converter = new QuillDeltaToHtmlConverter(delta.ops, {}); // Does not work as intended, seems like it does not handle deletions properly
    return converter.convert();
}

exports.convert = function (dbEntries) {
    let delta = new Delta();
    let currentOffset = 0;
    let insertBuffer = '';
    let deleteCount = 0;

    dbEntries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach(edit => {
        const {operationType, offset, span, text} = edit;

        if (offset > currentOffset) {
            if (insertBuffer.length > 0) {
                delta = delta.insert(insertBuffer);
                insertBuffer = '';
            }
            if (deleteCount > 0) {
                delta = delta.delete(deleteCount);
                deleteCount = 0;
            }
            delta = delta.retain(offset - currentOffset);
            currentOffset = offset;
        }

        if (operationType === 0) { // Insert
            insertBuffer += text;
            currentOffset += span;
        } else if (operationType === 1) { // Delete
            if (insertBuffer.length > 0) {
                delta = delta.insert(insertBuffer);
                insertBuffer = '';
            }
            deleteCount += span;
        } else if (operationType === 2) { // Retain
            currentOffset += span; // Adjust current offset for retain operations
        }
    });

    if (insertBuffer.length > 0) {
        delta = delta.insert(insertBuffer);
    }
    if (deleteCount > 0) {
        delta = delta.delete(deleteCount);
    }

    return delta;

}