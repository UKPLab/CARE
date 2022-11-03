<template>
  <div :id="'page-container-' + pageNumber"
       v-observe-visibility="{
      callback: visibilityChanged,
      throttle: 300,
      throttleOptions: {
        leading: 'visible',
      },
    }" class="pageContainer">
    <div :id="'canvas-wrapper-' + pageNumber" class="canvasWrapper">
      <canvas :id="'pdf-canvas-' + pageNumber" class="pdf-page"></canvas>
    </div>
    <div :id="'text-layer-' + pageNumber" class="textLayer">

    </div>
  </div>
  <Highlights :page_id="pageNumber" ref="highlights" :document_id="document_id"/>

</template>

<script>
/* PDFPage.vue - pdf page

This component holds a single pdf page and includes the rendering itself

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import * as pdfjsLib from "pdfjs-dist/build/pdf.js"
import {ObserveVisibility} from 'vue3-observe-visibility'
import debounce from 'lodash.debounce';
import Highlights from "./Highlights.vue";

import {createPlaceholder, removePlaceholder} from "../../../assets/anchoring/placeholder";
import {TextPosition, TextRange} from "../../../assets/anchoring/text-range";
import {matchQuote} from '../../../assets/anchoring/match-quote';


export default {
  name: 'PDFPage',
  components: {Highlights},
  props: {
    pdf: {
      type: Object
    },
    pageNumber: {
      type: Number,
      default: 0,
    }
  },
  directives: {
    ObserveVisibility,
  },
  watch: {
    annotations(newVal, oldVal) {
      // handle only newly added anchors
      if (this.pdf.pageCount > 0) {
        newVal.filter(anchor => !oldVal.includes(anchor))
            .map(this.handle_anchor)
      }
    },
    annotationTags(newVal, oldVal) {
      //handle only updated values
      if (this.pdf.pageCount > 0) {
        newVal.filter(vnew => oldVal.map(vold => vold.anno).includes(vnew.anno))
            .filter(vnew => {
              const prevTags = oldVal.find(vold => vold.anno === vnew.anno).tags;
              const newTags = vnew.tags;

              return (prevTags === null) !== (newTags === null) ||
                  (prevTags.sort().toString() !== newTags.sort().toString())
            })
            .map(vnew => vnew.anno)
            .map(this.handle_tagchange)
      }
    },
  },
  data() {
    return {
      renderTask: undefined,
      isVisible: false,
      resizeOb: undefined,
      isRendered: false,
      scale: null,
    };
  },
  methods: {
    init() {
      this.pdf.getPage(this.pageNumber).then((page) => {
        const wrapper = document.getElementById('canvas-wrapper-' + page.pageNumber);
        const canvas = document.getElementById('pdf-canvas-' + page.pageNumber);

        this.scale = wrapper.getBoundingClientRect().width /
            page.getViewport({scale: 1.0}).width;

        const viewport = page.getViewport({scale: this.scale});
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (this.isVisible || !this.isVisible) {
          // stop rendering and wait for rerendering
          if (this.renderTask) {
            this.destroyRenderTask();
          }
          this.renderPage(page);
        }
      });
    },
    visibilityChanged(isVisible, entry) {
      this.isVisible = isVisible;
      if (this.isVisible && !this.isRendered) {
        this.init();
      }
      this.$emit('updateVisibility', {pageNumber: this.pageNumber, isVisible: isVisible});

      if (this.isVisible) {
        this.$socket.emit("stats", {action: "pageView", data: {pageNumber: this.pageNumber}});
      }
    },
    resizeHandler(event) {
      //if(this.isRendered) this.destroyPage();
      //this.init()
    },
    renderPage(page) {
      if (this.renderTask) return;

      const canvas = document.getElementById('pdf-canvas-' + page.pageNumber);
      const context = canvas.getContext('2d');
      const viewport = page.getViewport({scale: this.scale});

      let renderContext = {
        canvasContext: context,
        viewport: viewport
      }

      this.renderTask = page.render(renderContext);

      this.renderTask.promise.then(() => {
        return page.getTextContent();
      }).then((textContent) => {

        const canvas_offset = document.getElementById('pdf-canvas-' + page.pageNumber).getBoundingClientRect();
        const text_layer = document.getElementById('text-layer-' + page.pageNumber);

        text_layer.style.height = canvas_offset.height + 'px';
        text_layer.style.width = canvas_offset.width + 'px';

        pdfjsLib.renderTextLayer({
          textContent: textContent,
          enhanceTextSelection: true,
          container: document.getElementById('text-layer-' + page.pageNumber),
          viewport: viewport,
          textDivs: []
        })

        this.isRendered = true;
        this.pdf.renderingDone.set(page.pageNumber, true);
        this._update();

      }).catch(response => {
        this.destroyRenderTask();
        console.log(`Failed to render page ${this.pageNumber}: ` + response);

      });
    },
    destroyPage() {
      // PDFPageProxy#_destroy
      // https://mozilla.github.io/pdf.js/api/draft/PDFPageProxy.html
      this.$emit('destroyPage', {pageNumber: this.pageNumber});
      this.destroyRenderTask();
    },
    destroyRenderTask() {
      if (!this.renderTask) return;
      // RenderTask#cancel
      // https://mozilla.github.io/pdf.js/api/draft/RenderTask.html
      this.renderTask.cancel();
      this.isRendered = false;
      this.pdf.renderingDone.set(this.pageNumber, false);
      this.renderTask = undefined;
    },
    async _update() {
      const refreshAnnotations = /** @type {AnnotationData[]} */ ([]);

      // Find all the anchors that have been invalidated by page state changes.
      for (let anchor of this.anchors) {
        // If the anchor already has a highlight, check if we cannot find the highlight element, else refresh anyways
        if (anchor.highlights) {
          if (refreshAnnotations.includes(anchor.annotation)) {
            continue;
          }

          // If the highlights are no longer in the document it means that either
          // the page was destroyed by PDF.js or the placeholder was removed above.
          // The annotations for these anchors need to be refreshed.
          for (let index = 0; index < anchor.highlights.length; index++) {
            const hl = anchor.highlights[index];
            if (!document.body.contains(hl)) {
              anchor.highlights.splice(index, 1);
              delete anchor.range;
              refreshAnnotations.push(anchor.annotation);
              break;
            }
          }
        } else {
          refreshAnnotations.push(anchor.annotation);
        }
      }

      refreshAnnotations.map(annotation => this.handle_anchor(annotation));
    },
    _updateAnnotationLayerVisibility() {
      const selection = /** @type {Selection} */ (window.getSelection());
      // TODO CSS Style
      // Add CSS class to indicate whether there is a selection. Annotation
      // layers are then hidden by a CSS rule in `pdfjs-overrides.scss`.
      this.pdfViewer.viewer.classList.toggle(
          'is-selecting',
          !selection.isCollapsed
      );
    },
    async handle_anchor(annotation) {
      const locate = async target => {
        // Only annotations with an associated quote can currently be anchored.
        // This is because the quote is used to verify anchoring with other selector
        // types.
        if (
            !target.selector ||
            !target.selector.some(s => s.type === 'TextQuoteSelector')
        ) {
          return {annotation, target};
        }

        /** @type {Anchor} */
        let anchor;
        try {

          let quotePositionCache = new Map();

          const anchorByPosition = async (pageIndex, start, end) => {

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

          const quotePositionCacheKey = (quote, pos) => {
            return `${quote}:${pos}`;
          }

          const stripSpaces = (str) => {
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

          const findPageByOffset = async (offset) => {


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

          const anchorQuote = async (quoteSelector, positionHint) => {
            // Determine which pages to search and in what order. If we have a position
            // hint we'll try to use that. Otherwise we'll just search all pages in order.
            const pageCount = this.pdf.pageCount;
            const pageIndexes = Array(pageCount)
                .fill(0)
                .map((_, i) => i);

            let expectedPageIndex;
            let expectedOffsetInPage;

            if (positionHint) {
              const {index, offset} = await findPageByOffset(positionHint);
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
                quoteSelector.prefix !== undefined ? stripSpaces(quoteSelector.prefix) : [];
            const [strippedSuffix] =
                quoteSelector.suffix !== undefined ? stripSpaces(quoteSelector.suffix) : [];
            const [strippedQuote] = stripSpaces(quoteSelector.exact);

            let bestMatch;
            for (let page of pageIndexes) {
              const text = await this.pdf.getPageTextContent(page);

              if (!text) continue;
              const [strippedText, offsets] = stripSpaces(text);


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
                const cacheKey = quotePositionCacheKey(quoteSelector.exact, positionHint);
                quotePositionCache.set(cacheKey, {
                  pageIndex: page,
                  anchor: match,
                });
              }

              // Convert the (start, end) position match into a DOM range.
              return anchorByPosition(page, match.start, match.end);
            }

            throw new Error('Quote not found');
          }

          const PDFanchor = async (root, selectors) => {
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
                const {index, offset, text} = await findPageByOffset(position.start);
                const start = position.start - offset;
                const end = position.end - offset;

                const matchedText = text.substring(start, end);
                if (quote.exact !== matchedText) {
                  throw new Error('quote mismatch');
                }

                const range = await anchorByPosition(index, start, end);
                return range;
              } catch {
                // Fall back to quote selector
              }

              // If anchoring with the position failed, check for a cached quote-based
              // match using the quote + position as a cache key.
              try {
                const cacheKey = quotePositionCacheKey(quote.exact, position.start);
                const cachedPos = quotePositionCache.get(cacheKey);
                if (cachedPos) {
                  const {pageIndex, anchor} = cachedPos;
                  const range = await anchorByPosition(
                      pageIndex,
                      anchor.start,
                      anchor.end
                  );
                  return range;
                }
              } catch {
                // Fall back to uncached quote selector match
              }
            }

            return anchorQuote(quote, position?.start);
          }

          const range = await PDFanchor(
              document.getElementById('pdfContainer'),
              target.selector
          );

          // Convert the `Range` to a `TextRange` which can be converted back to
          // a `Range` later. The `TextRange` representation allows for highlights
          // to be inserted during anchoring other annotations without "breaking"
          // this anchor.
          const textRange = TextRange.fromRange(range);
          anchor = {annotation, target, range: textRange};
        } catch (err) {
          anchor = {annotation, target};
          console.log("Error getting anchors: " + err);
        }
        return anchor;
      };

      let anchors;
      if ("annotationData" in annotation &&
          annotation.annotationData.target !== null &&
          annotation.annotationData.target !== undefined) {
        anchors = await Promise.all(annotation.annotationData.target.map(locate));
        annotation.anchors = anchors;
      } else {
        anchors = [];
      }

      // Set flag indicating whether anchoring succeeded. For each target,
      // anchoring is successful either if there are no selectors (ie. this is a
      // Page Note) or we successfully resolved the selectors to a range.
      annotation.orphaned =
          anchors.length > 0 &&
          anchors.every(anchor => anchor.target.selector && !anchor.range);

    },
    handle_tagchange(annotation) {
      // skip un-anchored annotations
      if (annotation.anchors === null || annotation.anchors === undefined || annotation.anchors.length === 0) {
        return;
      }

      // redraw highlights
      this.$refs["highlights"].update_highlights(annotation.anchors);
    },
    destroyPage(page) {
      this.$refs.highlights.removeAllHighlights(document.getElementById('text-layer-' + page.pageNumber));
      const text_layer = document.getElementById('text-layer-' + page.pageNumber);

      // clean text layer
      while (text_layer.firstChild) {
        text_layer.removeChild(text_layer.firstChild);
      }
    },
  },
  mounted() {
    this.init()
    this.resizeOb = new ResizeObserver(debounce(this.resizeHandler, 1000));
    this.resizeOb.observe(document.getElementById('canvas-wrapper-' + this.pageNumber));
  },
  beforeUnmount() {
    if (this.resizeOb) {
      this.resizeOb.disconnect();
    }
    this.destroyPage(this.pageNumber);
  },
  computed: {
    annotations() {
      return this.$store.getters['anno/getPageAnnotations'](this.document_id, this.pageNumber);
    },
    annotationTags() {
      return this.$store.getters['anno/getAnnotationTags'](this.document_id);
    },
    anchors() {
      return [].concat(this.$store.getters['anno/getAnchorsFlat'](this.document_id, this.pageNumber))
    },
  }
};
</script>
<style>
.pageContainer {
  position: relative;
  border-bottom-style: solid;
}
</style>