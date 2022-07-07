import _ from 'lodash';

// make sure, it's not been reactive!
const state = { pdf: undefined };

export class PDF {

    constructor(BUFFER_PAGES = 10) {
        this.pageCount = 0;
        this.pages = [];
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

    getPage(pageNumber) {
        return state.pdf.getPage(pageNumber);
    }

    fetchPages(currentPage = 0) {
        if (!state.pdf) return;
        if (this.pageCount > 0 && this.pages.length === this.pageCount) return;

        const startIndex = this.pages.length;
        if (this.cursor > startIndex) return;

        const startPage = startIndex + 1;
        const endPage = Math.min(Math.max(currentPage, startIndex + this.BUFFER_PAGES), this.pageCount);
        this.cursor = endPage;

        console.log("Start fetching pages...");
        this.getPages(startPage, endPage)
          .then((pages) => {
              console.log(pages);
            const deleteCount = 0;
            this.pages.splice(startIndex, deleteCount, ...pages);
            return this.pages;
          }).catch((response) => {
              console.log("Error");
           console.log(response);
          })
    }

    getPages(first, last) {
        console.log("Start getPages " + first + " " + last);
        console.log(state.pdf);
      const allPages = _.range(first, last + 1).map(number => state.pdf.getPage(number));
      console.log(allPages);
      return Promise.all(allPages);
    }

}