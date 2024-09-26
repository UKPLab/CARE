// make sure, it's not been reactive!
const state = {pdf: undefined, pages: {}};

/**
 *  PDF Store
 *
 * All information about the PDF are stored in this class.
 * The class holds the pdf.js object and it is the central entry point for all components that
 * interact with the pdf.js object.
 *
 * Note: This is needed, because vue3 only provides a copy of the original object, which not includes hidden properties.
 * PDF.js uses hidden properties e.g. generate pdf page
 *
 * @author Dennis Zyska
 */
export class PDF {

    constructor(pdf, SIZE = 10) {
        this.BUFFER_SIZE = SIZE;
    }

    reset() {
        state.pdf = {pdf: undefined};
        state.pages = {};

        this.currentBuffer = [];
        this.pageCount = 0;
        this.cursor = 0;
        this.pageTextCache = new Map();
        this.renderingDone = new Map();
    }

    setPDF(pdf) {
        this.reset();
        state.pdf = pdf;
        this.pageCount = state.pdf.numPages;
    }

    async getPage(pageNumber) {

        if (!(pageNumber in state.pages)) {

            //Buffer handling
            if (this.currentBuffer.length > this.BUFFER_SIZE) {
                delete state.pages[this.currentBuffer.shift()];
            }
            this.currentBuffer.push(pageNumber);

            await state.pdf.getPage(pageNumber).then((page) => {
                state.pages[pageNumber] = page;
            });
        }
        return state.pages[pageNumber];
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