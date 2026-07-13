const isCommentOrEmptyLine = (lineNumber, lines, comments) => {
    const line = lines[lineNumber - 1]

    if (!line.trim()) return true

    const nonCommentContent = comments
        .filter(
            (comment) =>
                comment.loc.start.line <= lineNumber &&
                comment.loc.end.line >= lineNumber,
        )
        .reduce((content, comment) => {
            const start =
                comment.loc.start.line === lineNumber
                    ? comment.loc.start.column
                    : 0
            const end =
                comment.loc.end.line === lineNumber
                    ? comment.loc.end.column
                    : content.length

            return `${content.slice(0, start)}${content.slice(end)}`
        }, line)

    return !nonCommentContent.trim()
}

export default {
    meta: {
        type: 'suggestion',
        schema: [],
        messages: {
            tooManyLines:
                'This file has {{lineCount}} lines of code. Keep files below 300 lines where practical.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode
        const comments = sourceCode.getAllComments()

        return {
            'Program:exit'() {
                const codeLineNumbers = sourceCode.lines.flatMap(
                    (_line, index) =>
                        isCommentOrEmptyLine(
                            index + 1,
                            sourceCode.lines,
                            comments,
                        )
                            ? []
                            : [index + 1],
                )
                const lineCount = codeLineNumbers.length

                if (lineCount >= 300 && lineCount <= 700) {
                    context.report({
                        loc: {
                            start: {
                                line: codeLineNumbers[299],
                                column: 0,
                            },
                            end: {
                                line: codeLineNumbers[299],
                                column: sourceCode.lines[codeLineNumbers[299] - 1].length,
                            },
                        },
                        messageId: 'tooManyLines',
                        data: { lineCount },
                    })
                }
            },
        }
    },
}
