const connectEnsureLogin = require('connect-ensure-login');
const pdb = require("../../tools/db.js")

module.exports = function(app) {
    app.use("/user/*", connectEnsureLogin.ensureLoggedIn("/login"));

    app.get('/user/docs', function(req, res) {
        res.setHeader('Content-Type', 'application/json');

        pdb.query('SELECT * FROM public."document" WHERE "creator" = $1 and "deleted" = False', [ req.user.uid ])
            .then((rows) => {
                console.log(rows);
                if (!rows) {
                    return res.status(200).end(JSON.stringify({"docs": [], "status": "FAIL"}));
                }

                return res.status(200).end(JSON.stringify({"docs": rows, "status": "OK"}));
            })
            .catch((err) => {
                return res.status(401).end(JSON.stringify({"docs": [], "status": "FAIL"}));
            });
    });
};