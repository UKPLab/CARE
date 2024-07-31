import debounce from "lodash.debounce";

class BehaviorLogger {
    constructor(socket, options = {}) {
        this.socket = socket;
        this.options = {
            debounceTime: 500,
            ...options
        };

        // Search state
        this.searchActive = false;
        this.searchStartTime = null;
        this.currentSearchId = null;

        // Bind methods
        this.reportMouseMove = debounce(this.reportMouseMove.bind(this), this.options.debounceTime);
        this.reportClick = this.reportClick.bind(this);
        this.reportTabVisibilityChange = this.reportTabVisibilityChange.bind(this);
        this.reportRouteChange = this.reportRouteChange.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleWindowFocus = this.handleWindowFocus.bind(this);
    }

    // TODO: I want to add
    // Device and Environment Information:
    // * Screen size and resolution
    // * Device type (desktop, tablet, mobile)
    // * Browser information
    // Search and Find Operations:
    // * Use of search functionality
    // * Frequency and patterns of find/replace operations
    // Keyboard Activity:
    // * Key presses (especially for common shortcuts)
    // * Typing speed and patterns

    init() {
        document.addEventListener('mousemove', this.reportMouseMove);
        document.addEventListener('click', this.reportClick);
        document.addEventListener('visibilitychange', this.reportTabVisibilityChange);
        document.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('focus', this.handleWindowFocus);
    }

    destroy() {
        document.removeEventListener('mousemove', this.reportMouseMove);
        document.removeEventListener('click', this.reportClick);
        document.removeEventListener('visibilitychange', this.reportTabVisibilityChange);
        document.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('focus', this.handleWindowFocus);
    }

    handleKeyDown(event) {
        if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
            // Search started
            this.startSearch();
        } else
            console.log(event.key);
    }

    handleWindowFocus() {
        if (this.searchActive) {
            // Assume search is complete if window regains focus
            this.reportSearchEvent(`complete`);
            this.searchActive = false;
        }
    }

    startSearch() {
        this.searchActive = true;
        this.searchStartTime = Date.now();
        this.currentSearchId = Date.now().toString();
        this.reportSearchEvent('start');
    }

    reportSearchEvent(status) {
        const timestamp = Date.now();
        const duration = this.searchStartTime ? timestamp - this.searchStartTime : 0;

        this.socket.emit("stats", {
            action: "search_event",
            data: {
                searchId: this.currentSearchId,
                status: status,
                duration: duration,
                timestamp: timestamp
            }
        });

        // Reset search state
        if (status !== 'start') {
            this.searchStartTime = null;
            this.currentSearchId = null;
        }
    }

    reportMouseMove(event) {
        this.socket.emit("stats", {
            action: "mouseMove",
            data: {
                clientX: event.clientX,
                clientY: event.clientY,
                scrollX: window.scrollX,
                scrollY: window.scrollY,
                timestamp: Date.now()
            }
        });
    }

    reportClick(event) {
        const target = event.target.closest('button, a, .clickable-element');
        if (target) {
            const rect = target.getBoundingClientRect();
            this.socket.emit("stats", {
                action: "click",
                data: {
                    // TODO: subject to debate which of these are useful
                    elementType: target.tagName,
                    elementId: target.id,
                    elementClass: target.className,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    globalX: event.clientX + window.globalX,
                    globalY: event.clientY + window.globalY,
                    elementX: rect.left + window.elementX,
                    elementY: rect.top + window.elementY,
                    elementWidth: rect.width,
                    elementHeight: rect.height,
                    path: window.location.pathname,
                    timestamp: Date.now()
                }
            });
        }
    }

    reportTabVisibilityChange() {
        this.socket.emit("stats", {
            action: "tabVisibilityChange",
            data: {
                hidden: document.hidden,
                timestamp: Date.now()
            }
        });
    }

    reportRouteChange(from, to) {
        this.socket.emit("stats", {
            action: "routeStep",
            data: {
                from: from.fullPath,
                to: to.fullPath,
                timestamp: Date.now()
            }
        });
    }
}

export default BehaviorLogger;