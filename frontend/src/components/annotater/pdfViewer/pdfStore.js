/* PDF Store

All information about the PDF are stored in this class.
The class holds the pdf.js object and it is the central entry point for all components that
interact with the pdf.js object.

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import _ from 'lodash';

// make sure, it's not been reactive!
const state = {pdf: undefined};
const pages = {};

export class PDF {

    constructor(BUFFER_PAGES = 10) {
        this.currentBuffer = [];
        this.pageCount = 0;
        //this.pages = [];
        this.cursor = 0;
        this.pageTextCache = new Map();
        this.renderingDone = new Map();
        this.BUFFER_PAGES = BUFFER_PAGES;

    }

    setVisibility(pageNumber, isVisible) {

    }

    setPDF(pdf) {
        state.pdf = pdf;
        this.pageCount = state.pdf.numPages;
    }

    async getPage(pageNumber) {

        if (!(pageNumber in pages)) {

            //Buffer handling
            if (this.currentBuffer.length > this.BUFFER_PAGES) {
                delete pages[this.currentBuffer.shift()];
            }
            this.currentBuffer.push(pageNumber);

            await state.pdf.getPage(pageNumber).then((page) => {
                pages[pageNumber] = page;
            });
        }
        return pages[pageNumber];
    }

    fetchPages(currentPage = 0) {
        if (!state.pdf) return;
        if (this.pageCount > 0 && this.pages.length === this.pageCount) return;

        const startIndex = this.pages.length;
        if (this.cursor > startIndex) return;

        const startPage = startIndex + 1;
        const endPage = Math.min(Math.max(currentPage, startIndex + this.BUFFER_PAGES), this.pageCount);
        this.cursor = endPage;

        this.getPages(startPage, endPage)
            .then((pages) => {
                const deleteCount = 0; // 0 means insert
                this.pages.splice(startIndex, deleteCount, ...pages);
                return this.pages;
            }).catch((response) => {
            console.log("Error fetching Pages: " + response);
        })
    }

    getPages(first, last) {
        const allPages = _.range(first, last + 1).map(number => state.pdf.getPage(number));
        return Promise.all(allPages);
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