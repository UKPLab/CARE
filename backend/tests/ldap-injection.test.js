const LdapAuth = require('ldapauth-fork');

/**
 * Regression test for CWE-90 (LDAP injection) in backend/webserver/auth/strategies.js.
 *
 * strategies.js relies on ldapauth-fork (pinned to 5.0.5 via passport-ldapauth@3.0.1 in
 * backend/package-lock.json) to substitute {{username}} into the configured searchFilter.
 * This pins that ldapauth-fork escapes LDAP filter metacharacters at that substitution
 * point (lib/ldapauth.js `sanitizeInput` / `_findUser`), so the security property this
 * PR was chasing is enforced by the dependency, not by application code.
 */
describe('LDAP username escaping (ldapauth-fork)', () => {
    let ldap;
    let capturedFilter;

    beforeEach(() => {
        ldap = new LdapAuth({
            url: 'ldap://127.0.0.1:1',
            bindDN: 'cn=admin,dc=example,dc=com',
            bindCredentials: 'secret',
            searchBase: 'dc=example,dc=com',
            searchFilter: '(uid={{username}})',
        });

        // Bypass the network transport entirely; we only care about the filter
        // ldapauth-fork builds from the untrusted username, not the LDAP wire protocol.
        capturedFilter = undefined;
        ldap._search = (searchBase, options, callback) => {
            capturedFilter = options.filter;
            callback(null, []);
        };
    });

    afterEach((done) => {
        ldap.close(() => done());
    });

    const findUser = (username) =>
        new Promise((resolve, reject) => {
            ldap._findUser(username, (err) => {
                if (err) return reject(err);
                resolve(capturedFilter);
            });
        });

    // A syntactically valid RFC 4515 escape is a backslash followed by two hex digits.
    // Stripping all such sequences from the filter must leave no raw `(`, `)`, or `*`
    // outside the fixed (uid=...) wrapper - otherwise the value could restructure the filter.
    const isStructurallySafe = (filter) => {
        const stripped = filter.replace(/\\[0-9a-fA-F]{2}/g, '');
        return /^\(uid=[^()*]*\)$/.test(stripped);
    };

    test.each([
        // Note: ldapauth-fork@5.0.5's sanitizeInput runs its *, (, ) replacements
        // before its own \ replacement, so those three chars get double-escaped
        // (e.g. "*" -> "\5c2a" instead of "\2a"). This is a correctness bug (a
        // literal "*" in a username won't match a real directory value) but it
        // does not reopen the injection: the output is still fully escaped.
        ['*', '(uid=\\5c2a)'],
        ['(', '(uid=\\5c28)'],
        [')', '(uid=\\5c29)'],
        ['\\', '(uid=\\5c)'],
        ['\0', '(uid=\\00)'],
    ])('escapes %j in the search filter', async (input, expectedFilter) => {
        const filter = await findUser(input);
        expect(filter).toBe(expectedFilter);
        expect(isStructurallySafe(filter)).toBe(true);
    });

    test('a classic filter-injection payload cannot alter the filter structure', async () => {
        const payload = '*)(uid=*))(|(uid=*';
        const filter = await findUser(payload);

        expect(isStructurallySafe(filter)).toBe(true);
        expect(filter).toBe(
            '(uid=\\5c2a\\5c29\\5c28uid=\\5c2a\\5c29\\5c29\\5c28|\\5c28uid=\\5c2a)'
        );
    });
});
