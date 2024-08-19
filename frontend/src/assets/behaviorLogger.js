/**
 * This class functions as a behavior logger that tracks a set of specified javascript events and sends them to the
 * backend via a socket connection. The events currently tracked are:
 * - Mouse move events
 * - Click events
 * - Tab visibility changes
 * - Route changes
 * - Specific key down events (currently only cmd/ctrl + f to detect search start)
 * - Window focus events (currently only used to detect search end)
 * @author: Timo Imhof
 */

import debounce from "lodash.debounce";

/**
 * Class designed to track and log user behavior via interpreting specific JavaScript events
 * and sending notifications about them to the backend via a socket connection.
 * For more information on the events that are tracked, see the class description.
 * @param {Object} socket - The WebSocket connection object used to send data to the backend.
 * @param {Object} options - Configuration options for the logger. Currently only contains a debounce time.
 * @param {number} [options.debounceTime=500] - The debounce time in milliseconds for mouse move events.
 * @param {Array} [options.clickBlackList=[]] - A list of objects that should not be logged when clicked.
 */
class BehaviorLogger {
    constructor(socket, options = {}) {
        this.socket = socket;
        this.options = {
            debounceTime: 500,
            clickBlackList: [],
            ...options
        };

        // Search state
        this.searchActive = false;
        this.searchStartTime = null;
        this.currentSearchId = null;

        // Bind methods
        // (necessary to access the correct 'this' context when the methods are called as event listeners)
        this.reportMouseMove = debounce(this.reportMouseMove.bind(this), this.options.debounceTime);
        this.reportClick = this.reportClick.bind(this);
        this.reportTabVisibilityChange = this.reportTabVisibilityChange.bind(this);
        this.reportRouteChange = this.reportRouteChange.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleWindowFocus = this.handleWindowFocus.bind(this);
    }

    /**
     * Initializes the behavior logger by binding event listeners to the document and window objects.
     * Further directly logs device information on initialization.
     */
    init() {
        document.addEventListener('mousemove', this.reportMouseMove);
        document.addEventListener('click', this.reportClick);
        document.addEventListener('visibilitychange', this.reportTabVisibilityChange);
        document.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('focus', this.handleWindowFocus);

        // Log device info on initialization
        this.logDeviceInfo();
    }

    /**
     * Destroys the behavior logger by removing all event listeners from the document and window objects.
     */
    destroy() {
        document.removeEventListener('mousemove', this.reportMouseMove);
        document.removeEventListener('click', this.reportClick);
        document.removeEventListener('visibilitychange', this.reportTabVisibilityChange);
        document.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('focus', this.handleWindowFocus);
    }

    /**
     * Extracts device information and sends it to the backend via a socket connection.
     * The information that is extracted is:
     * - Screen size
     * - Device type (mobile or desktop)
     * - Browser information
     */
    logDeviceInfo() {
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;

        // source: https://medium.com/simplejs/detect-the-users-device-type-with-a-simple-javascript-check-4fc656b735e1
        function isMobile() {
            var check = false;
            (function (a) {
                if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4)))
                    check = true;
            })(navigator.userAgent || window.opera);
            return check;
        };

        this.socket.emit("stats", {
            action: "deviceInfo",
            data: {
                screenSize: {
                    width: screenWidth,
                    height: screenHeight,
                },
                deviceType: isMobile() ? 'mobile' : 'desktop',
                browserInfo: navigator.userAgent,
            }
        });
    }

    /**
     * Detects a key down event.
     * Used to detect the start of a search by the user (cmd/ctrl + f) and report it to the backend.
     * @param event The key down event object.
     */
    handleKeyDown(event) {
        if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
            // Search started
            this.startSearch();
        }
    }

    /**
     * Detects a window focus event.
     * If a search is active, the search is assumed to be complete and reported to the backend.
     */
    handleWindowFocus() {
        if (this.searchActive) {
            // Assume search is complete if window regains focus
            this.reportSearchEvent(`complete`);
            this.searchActive = false;
        }
    }

    /**
     * Sets the search state to active and reports the start of a search to the backend.
     */
    startSearch() {
        this.searchActive = true;
        this.searchStartTime = Date.now();
        this.currentSearchId = Date.now().toString();
        this.reportSearchEvent('start');
    }

    /**
     * Reports a search event to the backend via a socket connection.
     * @param status The status of the search event (start, complete).
     */
    reportSearchEvent(status) {
        const duration = this.searchStartTime ? Date.now() - this.searchStartTime : 0;

        this.socket.emit("stats", {
            action: "search_event",
            data: {
                searchId: this.currentSearchId,
                status: status,
                duration: duration,
            }
        });

        // Reset search state
        if (status !== 'start') {
            this.searchStartTime = null;
            this.currentSearchId = null;
        }
    }

    /**
     * Reports a mouse move event to the backend via the socket connection.
     * This event is debounced based on the `debounceTime` option.
     * @param event The mouse move event object.
     */
    reportMouseMove(event) {
        this.socket.emit("stats", {
            action: "mouseMove",
            data: {
                clientX: event.clientX,
                clientY: event.clientY,
                scrollX: window.scrollX,
                scrollY: window.scrollY,
            }
        });
    }

    /**
     * Reports a click event to the backend via the socket connection whenever a click event is detected on any element.
     * If the clicked element is in the clickBlackList, the event is not reported.
     * @param event The click event object.
     */
    reportClick(event) {
        const target = event.target;

        // Check if the clicked element is in the clickBlackList
        // Necessary to avoid double logging of certain elements for which dedicated event listeners are already set
        if (this.options.clickBlackList.some(item => target.matches(item))) {
            return;
        }

        this.socket.emit("stats", {
            action: "click",
            data: {
                composedPath: event.composedPath().map(el => el.tagName),
                elementType: target.tagName,
                elementId: target.id,
                elementClass: target.className,
                clientX: event.clientX,
                clientY: event.clientY,
                pageX: event.pageX,
                pageY: event.pageY,
                path: window.location.pathname,
            }
        });
    }

    /**
     * Reports a tab visibility change event to the backend via a socket connection.
     * This event is triggered when the user switches tabs or minimizes the browser window.
     */
    reportTabVisibilityChange() {
        this.socket.emit("stats", {
            action: "tabVisibilityChange",
            data: {
                hidden: document.hidden,
            }
        });
    }

    /**
     * Reports a route change event to the backend via a socket connection.
     * @param from The route object representing the old route.
     * @param to The route object representing the new route.
     */
    reportRouteChange(from, to) {
        this.socket.emit("stats", {
            action: "routeStep",
            data: {
                from: from.fullPath,
                to: to.fullPath,
            }
        });
    }
}

// Export the class for use in other files (e.g. App.vue)
export default BehaviorLogger;