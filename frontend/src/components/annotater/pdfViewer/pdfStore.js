import _ from 'lodash';

// make sure, it's not been reactive!
const state = {pdf: undefined};
const pages = {};

/* PDF Store

All information about the PDF are stored in this class.
The class holds the pdf.js object and it is the central entry point for all components that
interact with the pdf.js object.

Author: Dennis Zyska
Source: -
*/
export class PDF {

    constructor(SIZE = 10) {
        this.currentBuffer = [];
        this.pageCount = 0;
        this.cursor = 0;
        this.pageTextCache = new Map();
        this.renderingDone = new Map();
        this.BUFFER_SIZE = SIZE;

    }

    setPDF(pdf) {
        state.pdf = pdf;
        this.pageCount = state.pdf.numPages;
    }

    async getPage(pageNumber) {

        if (!(pageNumber in pages)) {

            //Buffer handling
            if (this.currentBuffer.length > this.BUFFER_SIZE) {
                delete pages[this.currentBuffer.shift()];
            }
            this.currentBuffer.push(pageNumber);

            await state.pdf.getPage(pageNumber).then((page) => {
                pages[pageNumber] = page;
            });
        }
        return pages[pageNumber];
    }

    async getPageTextContent(pageIndex) {
        const cachedText = this.pageTextCache.get(pageIndex);
        if (cachedText) {
            return cachedText;
        } else {
            // we have to load the page first!
            const textContent = await this.getPage(pageIndex + 1).then((page) => {
                return page.getTextContent({normalizeWhitespace: true})
            });
            const text = textContent.items.map(it => it.str).join('');

            this.pageTextCache.set(pageIndex, text);

            return text
        }

    }

}