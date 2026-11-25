const fs = require('fs');
const path = require('path');
const {REST, SOCKET_ONLY} = require('../webserver/rest/socketEvents');

const SOCKETS_DIR = path.join(__dirname, '../webserver/sockets');

/**
 * Every event the socket files register with createSocket("name", ...).
 *
 * @returns {string[]} the event names, sorted
 */
function socketEvents() {
    const names = new Set();
    for (const file of fs.readdirSync(SOCKETS_DIR).filter((name) => name.endsWith('.js'))) {
        const source = fs.readFileSync(path.join(SOCKETS_DIR, file), 'utf8');
        for (const match of source.matchAll(/createSocket\(\s*["'](\w+)["']/g)) {
            names.add(match[1]);
        }
    }
    return [...names].sort();
}

/**
 * The REST decision list in webserver/rest/socketEvents.js must cover every socket event, so a new
 * socket feature cannot be added without deciding whether it belongs in the REST API.
 */
describe('REST coverage of socket events', () => {
    const events = socketEvents();
    const listed = [...Object.keys(REST), ...Object.keys(SOCKET_ONLY)];

    test('finds the socket events', () => {
        expect(events.length).toBeGreaterThan(100);
    });

    test('every socket event is listed as REST or socket-only', () => {
        const missing = events.filter((name) => !listed.includes(name));
        expect(missing).toEqual([]);
    });

    test('no listed event is gone from the socket files', () => {
        expect(listed.filter((name) => !events.includes(name))).toEqual([]);
    });

    test('no event is listed twice', () => {
        expect(Object.keys(REST).filter((name) => name in SOCKET_ONLY)).toEqual([]);
    });
});
