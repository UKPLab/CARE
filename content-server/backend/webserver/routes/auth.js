const passport = require('passport');
const LocalStrategy = require('passport-local');
const crypto = require('crypto');
const { pdb, addUser } = require('../../tools/db.js');

// Login
passport.use(new LocalStrategy(function verify(username, password, cb) {
    pdb.query('SELECT * FROM public."user" WHERE "user_name" = $1 OR "email" = $1', [ username ])
        .then((rows) => {
            if (!rows || rows.length !== 1) { return cb(null, false, { message: 'Incorrect username or password.' }); }

            crypto.pbkdf2(password, rows[0].salt, 310000, 32, 'sha256', function(err, hashedPassword) {
              if (err) { return cb(err); }

              if (!crypto.timingSafeEqual(Buffer.from(rows[0].password_hash, 'hex'), hashedPassword)) {
                return cb(null, false, { message: 'Incorrect username or password.' });
              }

              // filter row object, because not everything is the right information for website
                const relevantKeys = ['email', 'first_name', 'last_name', 'sys_role', 'user_name', 'uid', 'hid'];
                const return_values = Object.keys(rows[0])
                    .filter((key) => relevantKeys.includes(key))
                    .reduce((obj, key) => {
                        obj[key] = rows[0][key];
                        return obj
                    }, {});
              return cb(null, return_values);
            });
        })
        .catch((err) => {
            return cb(err);
        })
}));

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

// register
async function register(user_credentials, res){
    const user_name = user_credentials["user_name"];
    const email = user_credentials["email"];
    const first_name = user_credentials["first_name"];
    const last_name = user_credentials["last_name"];
    const pwd = user_credentials["password"];
    const agree = user_credentials["terms"];

    if(!user_name || !email || !first_name || !last_name || !pwd || !agree){
        res.status(400).send("All credential fields need to be provided");
    } else {
        addUser(user_name, email, pwd, "regular")
            .then((success) => {
                res.status(201).send("User was created");
            })
            .catch((err) => {
                res.status(400).send("Cannot create a user with the given user name or email. Error: " + err);
            });
    }
}

module.exports = function(app) {


    app.post('/auth/login', function(req, res, next) {
        passport.authenticate('local', function(err, user, info) {
        if (err) { return res.status(500).send(err); }
        if (!user) { return res.status(401).send(info); }
        req.logIn(user, function(err) {
          if (err) { return next(err); }
           res.status(200).send({user:user});
        });
      })(req, res, next);
    });

    // Logout Procedure, no feedback needed since vuex also deletes the session
    app.get(
        '/auth/logout',
        function(req, res) {
            req.logout()
            req.session.destroy();
            res.status(200).send("Session destroyed!");
        }
    )

    app.get(
        '/auth/check',
        function(req, res) {
            if (req.user) {
                res.status(200).send({user:req.user});
            } else {
                res.status(401);
            }
            console.log(`req.session.passport: ${JSON.stringify(req.session.passport)}`);
            console.log(`req.user: ${JSON.stringify(req.user)}`);
        }
    );

    app.post(
        '/auth/register',
        function(req, res) {
            register(req.body, res);
        }
    );
};