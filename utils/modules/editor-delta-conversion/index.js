const Delta = require('quill-delta');
const {QuillDeltaToHtmlConverter} = require('quill-delta-to-html');

function convertToHtml(delta) {
    const converter = new QuillDeltaToHtmlConverter(delta.ops, {}); // Does not work as intended, seems like it does not handle deletions properly
    return converter.convert();
}

function convert(dbEntries) {
    return dbEntries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach(edit => {
        const {operationType, offset, span, text, attributes} = edit;

        let delta = new Delta();

        switch (operationType) {
            case 0:
                delta = delta.retain(offset);
                delta = delta.insert(text, attributes);
            case 1:
                delta = delta.retain(offset);
                delta = delta.delete(span);
            case 2:
                delta = delta.retain(offset, attributes);
        }

        return delta;

    });

}


function getOperationType(op) {
    if ('insert' in op) {
        return 0; // Insert
    } else if ('delete' in op) {
        return 1; // Delete
    } else if ('attribute' in op) {
        return 2; // Attribute Change
    } else {
        return -1;
    }
}

function getSpan(op) {
    if ('insert' in op) {
        return op.insert.length;
    } else if ('delete' in op) {
        return op.delete;
    } else {
        return op.retain;
    }
}

function deltaToDb(ops) {
    let offset = 0;
    return ops.reduce(function (pV, op) {
        if (op.retain) {
            offset += op.retain;
        }
        if (getOperationType(op) >= 0) {
            pV.push({
                offset,
                operationType: getOperationType(op),
                span: getSpan(op),
                text: op.insert || null,
                attributes: op.attributes || null
            });
        }
        return pV;

    }, []);
}

module.exports = {
    deltaToDb: deltaToDb,
    convert: convert,
    convertToHtml: convertToHtml
}