import { markRaw } from 'vue';

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
        this.state = {pdf: undefined, pages: {}};
    }

    reset() {
        this.state.pdf = {pdf: undefined};
        this.state.pages = {};

        this.currentBuffer = [];
        this.pageCount = 0;
        this.cursor = 0;
        this.pageTextCache = new Map();
        this.pageLayoutCache = new Map();
        this.renderingDone = new Map();
    }

    setPDF(pdf) {
        this.reset();
        this.state.pdf = markRaw(pdf);
        this.pageCount = this.state.pdf.numPages;
    }

    async getPage(pageNumber) {

        if (!(pageNumber in this.state.pages)) {

            //Buffer handling
            if (this.currentBuffer.length > this.BUFFER_SIZE) {
                delete this.state.pages[this.currentBuffer.shift()];
            }
            this.currentBuffer.push(pageNumber);

            await this.state.pdf.getPage(pageNumber).then((page) => {
                this.state.pages[pageNumber] = markRaw(page);
            });
        }
        return this.state.pages[pageNumber];
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

    /**
     * Returns the vertical position of a text offset without rendering the page,
     * so annotations on not yet rendered pages can be placed close to their final position.
     *
     * @param {number} pageIndex 0-based page index
     * @param {number} offset document-wide text offset (as in the TextPositionSelector)
     * @returns {Promise<number|null>} distance from the page top in units of the page width, null if unknown
     */
    async getTextTop(pageIndex, offset) {
        if (!this.pageLayoutCache.has(pageIndex)) {
            const page = await this.getPage(pageIndex + 1);
            const textContent = await page.getTextContent({normalizeWhitespace: true});
            const [x0, , x1, y1] = page.view;
            let start = 0;
            const items = textContent.items.map(item => {
                const layout = {start, top: y1 - item.transform[5] - item.height};
                start += item.str.length;
                return layout;
            });
            this.pageLayoutCache.set(pageIndex, {items, width: x1 - x0});
        }
        const {items, width} = this.pageLayoutCache.get(pageIndex);

        let pageStart = 0;
        for (let i = 0; i < pageIndex; i++) {
            pageStart += (await this.getPageTextContent(i))?.length ?? 0;
        }
        const item = items.findLast(item => item.start <= offset - pageStart);
        return item ? item.top / width : null;
    }

}