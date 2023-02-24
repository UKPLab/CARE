import {TextPosition, TextRange} from "../anchoring/text-range";
import {createPlaceholder} from "../anchoring/placeholder";
import {matchQuote} from "../anchoring/match-quote";

export class Anchoring {
    constructor(pdf, pageNumber) {
        this.pdf = pdf;
        this.pageNumber = pageNumber;
        this.quotePositionCache = new Map();
    }


    async anchorByPosition(pageIndex, start, end) {

        if (this.pdf.renderingDone.get(pageIndex + 1)) {
            const root = document.getElementById('text-layer-' + (pageIndex + 1));

            const startPos = new TextPosition(root, start);
            const endPos = new TextPosition(root, end);
            return new TextRange(startPos, endPos).toRange();
        }

        // The page has not been rendered yet. Create a placeholder element and
        // anchor to that instead.
        const placeholder = createPlaceholder(document.getElementById('page-container-' + (pageIndex + 1)));
        const range = document.createRange();
        range.setStartBefore(placeholder);
        range.setEndAfter(placeholder);
        return range;
    }

    async PDFanchor(selectors) {
        const root = document.getElementById('page-container-' + this.pageNumber);

        const quote = /** @type {TextQuoteSelector|undefined} */ (
            selectors.find(s => s.type === 'TextQuoteSelector')
        );


        // The quote selector is required in order to check that text position
        // selector results are still valid.
        if (!quote) {
            throw new Error('No quote selector found');
        }

        const position = /** @type {TextPositionSelector|undefined} */ (
            selectors.find(s => s.type === 'TextPositionSelector')
        );

        if (position) {
            // If we have a position selector, try using that first as it is the fastest
            // anchoring method.
            try {
                const {index, offset, text} = await this.findPageByOffset(position.start);
                const start = position.start - offset;
                const end = position.end - offset;

                const matchedText = text.substring(start, end);
                if (quote.exact !== matchedText) {
                    throw new Error('quote mismatch');
                }

                const range = await this.anchorByPosition(index, start, end);
                return range;
            } catch {
                // Fall back to quote selector
            }

            // If anchoring with the position failed, check for a cached quote-based
            // match using the quote + position as a cache key.
            try {
                const cacheKey = this.quotePositionCacheKey(quote.exact, position.start);
                const cachedPos = this.quotePositionCache.get(cacheKey);
                if (cachedPos) {
                    const {pageIndex, anchor} = cachedPos;
                    const range = await this.anchorByPosition(
                        pageIndex,
                        anchor.start,
                        anchor.end
                    );
                    return range;
                }
            } catch(err) {
                console.log("Error finding quote selector:" + err);

            }
        }


        return this.anchorQuote(quote, position?.start);
    }

    async quotePositionCacheKey(quote, pos) {
        return `${quote}:${pos}`;
    }

    stripSpaces(str) {
        const offsets = [];
        let stripped = '';

        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === ' ' || char === '\t' || char === '\n') {
                continue;
            }
            stripped += char;
            offsets.push(i);
        }

        return [stripped, offsets];
    }

    async findPageByOffset(offset) {


        let pageStartOffset = 0;
        let pageEndOffset = 0;
        let text = '';

        for (let i = 0; i < this.pdf.pageCount; i++) {
            text = await this.pdf.getPageTextContent(i);
            if (text) {
                pageStartOffset = pageEndOffset;
                pageEndOffset += text.length;

                if (pageEndOffset >= offset) {
                    return {index: i, offset: pageStartOffset, text};
                }
            }
        }

        // If the offset is beyond the end of the document, just pretend it was on
        // the last page.
        return {index: this.pdf.pageCount - 1, offset: pageStartOffset, text};
    }

    async locateAnchor(target) {
        /** @type {Anchor} */
        let anchor;



        const range = await this.PDFanchor(
            target.selector
        );

        // Convert the `Range` to a `TextRange` which can be converted back to
        // a `Range` later. The `TextRange` representation allows for highlights
        // to be inserted during anchoring other annotations without "breaking"
        // this anchor.
        const textRange = TextRange.fromRange(range);
        anchor = {target, range: textRange};

        return anchor;


    }

    async anchorQuote(quoteSelector, positionHint) {
        // Determine which pages to search and in what order. If we have a position
        // hint we'll try to use that. Otherwise we'll just search all pages in order.
        const pageCount = this.pdf.pageCount;
        const pageIndexes = Array(pageCount)
            .fill(0)
            .map((_, i) => i);

        let expectedPageIndex;
        let expectedOffsetInPage;

        if (positionHint) {
            const {index, offset} = await this.findPageByOffset(positionHint);
            expectedPageIndex = index;
            expectedOffsetInPage = positionHint - offset;

            // Sort pages by distance from the page where we expect to find the quote,
            // based on the position hint.
            pageIndexes.sort((a, b) => {
                const distA = Math.abs(a - index);
                const distB = Math.abs(b - index);
                return distA - distB;
            });
        }

        // Search pages for the best match, ignoring whitespace differences.
        const [strippedPrefix] =
            quoteSelector.prefix !== undefined ? this.stripSpaces(quoteSelector.prefix) : [];
        const [strippedSuffix] =
            quoteSelector.suffix !== undefined ? this.stripSpaces(quoteSelector.suffix) : [];
        const [strippedQuote] = this.stripSpaces(quoteSelector.exact);

        let bestMatch;
        for (let page of pageIndexes) {
            const text = await this.pdf.getPageTextContent(page);

            if (!text) continue;
            const [strippedText, offsets] = this.stripSpaces(text);


            // Determine expected offset of quote in current page based on position hint.
            let strippedHint;
            if (expectedPageIndex !== undefined && expectedOffsetInPage !== undefined) {
                let hint;
                if (page < expectedPageIndex) {
                    hint = text.length; // Prefer matches closer to end of page.
                } else if (page === expectedPageIndex) {
                    hint = expectedOffsetInPage;
                } else {
                    hint = 0; // Prefer matches closer to start of page.
                }

                // Convert expected offset in original text into offset into stripped text.
                strippedHint = 0;
                while (strippedHint < offsets.length && offsets[strippedHint] < hint) {
                    ++strippedHint;
                }
            }

            const match = matchQuote(strippedText, strippedQuote, {
                prefix: strippedPrefix,
                suffix: strippedSuffix,
                hint: strippedHint,
            });

            if (!match) {
                continue;
            }

            if (!bestMatch || match.score > bestMatch.match.score) {
                bestMatch = {
                    page,
                    match: {
                        start: offsets[match.start],

                        // `match.end` is the offset one past the last character of the match
                        // in the stripped text. We need the offset one past the corresponding
                        // character in the original text.
                        //
                        // We assume here that matches returned by `matchQuote` must have
                        // be non-empty, so `match.end` > `match.start`.
                        end: offsets[match.end - 1] + 1,

                        score: match.score,
                    },
                };

                // If we find a very good match, stop early.
                //
                // There is a tradeoff here between optimizing search performance and
                // ensuring that we have found the best match in the document.
                //
                // The current heuristics are that we require an exact match for the quote
                // and either the preceding or following context. The context matching
                // helps to avoid incorrectly stopping the search early if the quote is
                // a word or phrase that is common in the document.
                const exactQuoteMatch =
                    strippedText.slice(match.start, match.end) === strippedQuote;

                const exactPrefixMatch =
                    strippedPrefix !== undefined &&
                    strippedText.slice(
                        Math.max(0, match.start - strippedPrefix.length),
                        match.start
                    ) === strippedPrefix;

                const exactSuffixMatch =
                    strippedSuffix !== undefined &&
                    strippedText.slice(match.end, strippedSuffix.length) === strippedSuffix;

                const hasContext =
                    strippedPrefix !== undefined || strippedSuffix !== undefined;

                if (
                    exactQuoteMatch &&
                    (exactPrefixMatch || exactSuffixMatch || !hasContext)
                ) {
                    break;
                }
            }
        }

        if (bestMatch) {
            const {page, match} = bestMatch;

            // If we found a match, optimize future anchoring of this selector in the
            // same session by caching the match location.
            if (positionHint) {
                const cacheKey = this.quotePositionCacheKey(quoteSelector.exact, positionHint);
                this.quotePositionCache.set(cacheKey, {
                    pageIndex: page,
                    anchor: match,
                });
            }

            // Convert the (start, end) position match into a DOM range.
            return this.anchorByPosition(page, match.start, match.end);
        }

        throw new Error('Quote not found');
    }
}
