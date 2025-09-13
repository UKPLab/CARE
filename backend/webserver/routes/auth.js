/**
 * Here the routes for login into the content server are provided.
 * This includes checking of tokens and register, login and logout.
 *
 * Routes for login
 *
 * @author Nils Dycke, Dennis Zyska
 */
const passport = require('passport');
const { generateToken, decodeToken } = require('../../utils/auth');

/**
 * Route for user management
 * @param {Server} server main server instance
 */
module.exports = function (server) {

    /**
     * Login Procedure
     */
    server.app.post('/auth/login', function (req, res, next) {
        passport.authenticate('local', function (err, user, info) {
            if (err) {
                server.logger.error("Login failed: " + err);
                return res.status(500).send("Failed to login");
            }
            if (!user) {
                server.logger.info("User not found: " +
                    JSON.stringify(info));
                return res.status(401).send(info);
            }
            req.logIn(user, async function (err) {
                if (err) {
                    return next(err);
                }

                let transaction;
                try {
                    transaction = await server.db.models['user'].sequelize.transaction();

                    await server.db.models['user'].registerUserLogin(user.id, {transaction: transaction});
                    await transaction.commit();
                } catch (e) {
                    await transaction.rollback();
                }

                res.status(200).send({user: user});
            });
        })(req, res, next);
    });

    /**
     * Logout Procedure, no feedback needed since vuex also deletes the session
     */
    server.app.get('/auth/logout', function (req, res) {
        req.logout(function (err) {
            if (err) {
                return next(err);
            }
            req.session.destroy();
            res.clearCookie('connect.sid');
            return res.status(200).send("Session destroyed!");
        });
    })

    /**
     * Check whether user is logged in
     */
    server.app.get('/auth/check', function (req, res) {
        if (req.user) {
            res.status(200).send({user: req.user});
        } else {
            res.status(401);
        }
        server.logger.debug(`req.session.passport: ${JSON.stringify(req.session.passport)}`);
        server.logger.debug(`req.user: ${JSON.stringify(req.user)}`);
    });

    /**
     * Register Procedure
     */
    server.app.post('/auth/register', async function (req, res) {

        const data = req.body;

        // check if name is defined if it is required
        if ((await server.db.models['setting'].get("app.register.requestName")) === "true") {
            if (!data.firstName) {
                return res.status(400).json({message: "Please provide a first name."});
            }
            if (!data.lastName) {
                return res.status(400).json({message: "Please provide a last name."});
            }
        }

        // check if other fields are defined
        if (!data.email) {
            return res.status(400).json({message: "Please provide a email."});
        } else {
            // check if username is already taken
            const user = await server.db.models['user'].getUserIdByEmail(data.email);
            if (user !== 0) {
                return res.status(400).json({message: "E-Mail already taken."});
            }
        }

        if (!data.password) {
            return res.status(400).json({message: "Please provide a password."});
        } else {
            if (data.password.length < 8) {
                return res.status(400).json({message: "Password does not meet requirements."});
            }
        }

        if (!data.acceptTerms && !data.isCreatedByAdmin) {
            return res.status(400).json({message: "Please agree to the terms of use."});
        }

        if (!data.userName) {
            return res.status(400).json({message: "Please provide a user name."});
        } else {
            // check if username is already taken
            const user = await server.db.models['user'].getUserIdByName(data.userName);
            if (user !== 0) {
                server.logger.info("Username already taken: " + data.userName)
                return res.status(400).json({message: "Username already taken."});
            }
        }

        // create user if all checks passed
        let transaction;
        try {
            transaction = await server.db.models['user'].sequelize.transaction();
            await server.db.models['user'].add({
                firstName: data.firstName,
                lastName: data.lastName,
                userName: data.userName,
                password: data.password,
                email: data.email,
                acceptTerms: data.acceptTerms,
                acceptStats: data.acceptStats,
                acceptedAt: data.acceptedAt
            }, {transaction});
            await transaction.commit();
            res.status(201).send("User was successfully created");
        } catch (err) {
            await transaction.rollback();
            server.logger.error("Cannot create user:", err);
            res.status(400).json({message: "Failed to create user", error: err.message});
        }
    });

    server.app.post('/auth/request-password-reset', async function (req, res) {
        console.log("Received password reset request:", req.body);
        const {email} = req.body;
        if (!email) {
            return res.status(400).json({message: "Please provide an email."});
        }
        try {
            const user = await server.db.models['user'].findOne({where: {email: email}});
            if (!user) {
                return res.status(401).json({message: "User with this email does not exist."});
            }
            
            // Generate token with encoded expiry (1 hour)
            const resetToken = generateToken(1);
            
            // Store only the token part in the database (no expiry needed)
            const decoded = decodeToken(resetToken);
            user.resetToken = decoded.tokenPart; // Store just the random part for lookup
            await user.save();
            
            // Send email with the full encoded token

            await server.sendMail(user.email, "Password Reset Request", `localhost:3000/reset-password?token=${resetToken}`);
            return res.status(200).json({message: "A password reset link has been sent."});
        } catch (err) {
            server.logger.error("Failed to find user:", err);
            return res.status(500).json({message: "Internal server error"});
        }
    });

    server.app.post('/auth/reset-password', async function (req, res) {
        const {token, newPassword} = req.body;
        if(server.db.models['setting'].get("app.login.forgotPassword") !== "true") {
            return res.status(400).json({message: "Password reset is disabled."});
        }
        if (!token || !newPassword) {
            return res.status(400).json({message: "Token and new password are required."});
        }
        if (newPassword.length < 8) {
            return res.status(400).json({message: "Password does not meet requirements."});
        }
        try {
            // Decode the token and check expiry
            const decoded = decodeToken(token);
            
            if (!decoded.isValid) {
                return res.status(400).json({message: "Invalid token format."});
            }
            
            if (decoded.expired) {
                return res.status(400).json({message: "Token has expired."});
            }
            
            // Find user by the token part stored in database
            const user = await server.db.models['user'].findOne({where: {resetToken: decoded.tokenPart}});
            if (!user) {
                return res.status(400).json({message: "Invalid token."});
            }
            
            // Reset password using the user model method and clear token
            await server.db.models['user'].resetUserPwd(user.id, newPassword);
            await server.db.models['user'].update({resetToken: null}, {where: {id: user.id}});
            
            return res.status(200).json({message: "Password has been reset successfully."});
        } catch (err) {
            server.logger.error("Failed to reset password:", err);
            return res.status(500).json({message: "Internal server error"});
        }   
    });

    server.app.get('/auth/check-reset-token', async function (req, res) {
        const {token} = req.query;
        if (!token) {
            return res.status(400).json({message: "Token is required."});
        }
        try {
            // Decode and validate token format/expiry
            const decoded = decodeToken(token);
            if (!decoded.isValid) {
                return res.status(400).json({message: "Invalid token format."});
            }
            if (decoded.expired) {
                return res.status(400).json({message: "Token has expired."});
            }
            
            // Check if token exists in database
            const user = await server.db.models['user'].findOne({
                where: {resetToken: decoded.tokenPart}
            });
            if (!user) {
                return res.status(404).json({message: "Token not found."});
            }
            
            return res.status(200).json({
                message: "Token is valid.", 
                expiryTime: decoded.expiryTime
            });
        } catch (error) {
            server.logger.error("Failed to check reset token:", error);
            return res.status(500).json({message: "Internal server error"});
        }
    });
}
