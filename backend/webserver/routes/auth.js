/**
 * Here the routes for login into the content server are provided.
 * This includes checking of tokens and register, login and logout.
 *
 * Routes for login
 *
 * @author Nils Dycke, Dennis Zyska
 */
const passport = require('passport');
const { TOTP, Secret } = require('otpauth');
const { generateToken, decodeToken, generateOTP } = require('../../utils/auth');

/**
 * Route for user management
 * @param {Server} server main server instance
 */
module.exports = function (server) {

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    /**
     * Helper function to get the base URL from settings
     */
    async function getBaseUrl() {
        const baseUrl = await server.db.models['setting'].get("system.baseUrl");
        return baseUrl || "localhost:3000"; // fallback to default if not set
    }

    /**
     * Helper function to get password reset token expiry from settings
     */
    async function getPasswordResetTokenExpiry() {
        return await server.db.models['setting'].get("system.auth.tokenExpiry.passwordReset") || 1; // fallback to 1 hour if not set
    }

    /**
     * Helper function to get email verification token expiry from settings
     */
    async function getEmailVerificationTokenExpiry() {
        return await server.db.models['setting'].get("system.auth.tokenExpiry.emailVerification") || 24; // fallback to 24 hours if not set
    }

    /**
     * Helper function to get password reset email rate limit from settings
     */
    async function getPasswordResetRateLimit() {
        return await server.db.models['setting'].get("app.login.passwordResetRateLimit") || 5; // fallback to 5 minutes if not set
    }

    /**
     * Helper function to get email verification rate limit from settings
     */
    async function getEmailVerificationRateLimit() {
        return await server.db.models['setting'].get("app.register.emailVerificationRateLimit") || 2; // fallback to 2 minutes if not set
    }

    /**
     * Rate limiting helper function to prevent email spam
     * @param {Object} user - The user object
     * @param {string} emailType - Type of email ('passwordReset' or 'verification')
     * @param {number} rateLimitMinutes - Rate limit in minutes
     * @returns {Object} - {allowed: boolean, remainingTime?: number}
     */
    function checkEmailRateLimit(user, emailType, rateLimitMinutes) {
        const now = new Date();
        const lastSentField = emailType === 'passwordReset' ? 'lastPasswordResetEmailSent' : 'lastVerificationEmailSent';
        
        if (user[lastSentField]) {
            const timeDiff = (now - new Date(user[lastSentField])) / (1000 * 60); // in minutes
            if (timeDiff < rateLimitMinutes) {
                const remainingTime = Math.ceil(rateLimitMinutes - timeDiff);
                return {
                    allowed: false,
                    remainingTime: remainingTime
                };
            }
        }
        
        return { allowed: true };
    }

    /**
     * Get enabled 2FA methods from a user record.
     * @param {Object} user - The user object
     * @returns {string[]} array of enabled 2FA methods
     */
    function getTwoFactorMethods(user) {
        if (!user) {
            return [];
        }

        if (Array.isArray(user.twoFactorMethods)) {
            return user.twoFactorMethods.filter((m) => !!m);
        }

        return [];
    }

    async function sendEmailOtp(userRecord) {
        if (!userRecord || !userRecord.email) {
            throw new Error("Email address missing for email 2FA.");
        }

        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        await server.db.models['user'].update(
            {
                twoFactorOtp: otp,
                twoFactorOtpExpiresAt: otpExpiresAt
            },
            { where: { id: userRecord.id } }
        );

        await server.sendMail(
            userRecord.email,
            "CARE - Two-Factor Authentication Code",
            `Hello ${userRecord.userName},
Your two-factor authentication code is: ${otp}

This code will expire in 10 minutes. If you didn't request this code, please ignore this email.

Thanks,
The CARE Team`
        );
    }

    /**
     * Request OTP again for 2FA verification
     * Called after password verification when user has 2FA enabled
     * Uses session to track 2FA state
     */
    async function resendEmailOtp(req, res) {
        // Check if session has 2FA pending state
        if (!req.session || !req.session.twoFactorPending) {
            return res.status(400).json({ message: "No pending 2FA verification found. Please login again." });
        }

        // Must have selected email 2FA
        if (req.session.twoFactorPending.method !== 'email') {
            return res.status(400).json({ message: "Email 2FA is not the selected method. Please select email first." });
        }
        
        try {
            const { userId } = req.session.twoFactorPending;

            // Get user details
            const user = await server.db.models['user'].findOne({
                where: { id: userId }
            });

            const methods = getTwoFactorMethods(user);

            if (!user || !methods.includes('email')) {
                // Clear invalid session state
                delete req.session.twoFactorPending;
                return res.status(400).json({ message: "Email 2FA is not enabled for this user." });
            }
            
            if (!user.email) {
                return res.status(400).json({ message: "User email not found. Cannot send OTP." });
            }
            
            await sendEmailOtp(user);
            
            return res.status(200).json({ 
                message: "OTP has been sent to your email address.",
                expiresIn: 10 // minutes
            });
            
        } catch (error) {
            server.logger.error("Failed to request OTP: " + error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    /**
     * Complete 2FA verification and log user in
     * Handles session save and login registration consistently for all 2FA methods
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {number} userId - User ID to log in
     */
    async function completeTwoFactorLogin(req, res, userId) {
        try {
            const user = await server.db.models['user'].findOne({
                where: { id: userId },
                raw: true
            });

            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }

            // Clear 2FA pending state from session
            delete req.session.twoFactorPending;

            // Complete login
            req.logIn(user, async function (err) {
                if (err) {
                    server.logger.error("Failed to log in user after 2FA: " + err);
                    return res.status(500).json({ message: "Failed to complete login." });
                }

                // Save session after login
                req.session.save((saveErr) => {
                    if (saveErr) {
                        server.logger.error("Failed to save session after login: " + saveErr);
                    }
                });

                // Register user login
                let transaction;
                try {
                    transaction = await server.db.models['user'].sequelize.transaction();
                    await server.db.models['user'].registerUserLogin(user.id, {transaction: transaction});
                    await transaction.commit();
                } catch (e) {
                    await transaction.rollback();
                }

                return res.status(200).json({ user: user });
            });
        } catch (error) {
            server.logger.error("Error completing 2FA login: " + error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    /**
     * Start 2FA if configured for the user.
     * - If exactly 1 method is configured: start it immediately (send email OTP if needed).
     * - If multiple methods are configured: require the client to select one via /auth/2fa/select.
     *
     * Returns true if a response has been sent (2FA flow started / selection required).
     */
    async function startTwoFactorIfConfigured(req, res, user, options = { mode: 'json' }) {
        const mode = options.mode || 'json'; // 'json' | 'redirect'

        const userRecord = await server.db.models['user'].findOne({
            where: { id: user.id },
            raw: true,
        });

        if (!userRecord) {
            return false;
        }

        const methods = getTwoFactorMethods(userRecord);
        if (!methods || methods.length === 0) {
            return false;
        }

        // Store 2FA pending state; method may be selected later
        req.session.twoFactorPending = {
            userId: userRecord.id,
            methods: methods,
            method: null,
        };

        const respondJson = (payload) => {
            req.session.save((err) => {
                if (err) {
                    server.logger.error("Failed to save session: " + err);
                    return res.status(500).json({ message: "Failed to initiate 2FA verification." });
                }
                return res.status(200).json(payload);
            });
        };

        const redirectTo = (path) => {
            req.session.save((err) => {
                if (err) {
                    server.logger.error("Failed to save session: " + err);
                    return res.redirect('/login?error=twofactor-session-save-failed');
                }
                return res.redirect(path);
            });
        };

        // Multiple methods -> require selection
        if (methods.length > 1) {
            if (mode === 'redirect') {
                return redirectTo(`/2fa/select`), true;
            }
            respondJson({
                requiresTwoFactor: true,
                selectionRequired: true,
                methods: methods,
            });
            return true;
        }

        // Single method -> start immediately
        const method = methods[0];
        req.session.twoFactorPending.method = method;

        try {
            if (method === 'email') {
                if (!userRecord.email) {
                    return res.status(400).json({ message: "Email address is required for email 2FA but not found for this user." });
                }
                await sendEmailOtp(userRecord);
            } else if (method === 'totp') {
                if (!userRecord.totpSecret) {
                    return res.status(400).json({ message: "TOTP 2FA is enabled but not configured (missing secret)." });
                }
            } else {
                return res.status(400).json({ message: `Unsupported 2FA method: ${method}` });
            }
        } catch (e) {
            server.logger.error("Failed to initiate 2FA: " + e);
            return res.status(500).json({ message: "Failed to initiate 2FA verification." });
        }

        if (mode === 'redirect') {
            if (method === 'email') {
                return redirectTo(`http://localhost:3000/2fa/verify/email`), true;
            }
            if (method === 'totp') {
                return redirectTo(`http://localhost:3000/2fa/verify/totp`), true;
            }
            return redirectTo(`/login?error=unsupported-2fa-method`), true;
        }

        respondJson({
            requiresTwoFactor: true,
            selectionRequired: false,
            method: method,
            methods: methods,
        });
        return true;
    }

    /**
     * Finalizes the login process by establishing a session and recording the login activity.
     * @param {Object} req - The Express request object.
     * @param {Object} res - The Express response object.
     * @param {Function} next - The Express next middleware function.
     * @param {Object} user - The authenticated user object from Passport strategies.
     * @param {Object} options - Configuration for the response.
     * @param {string} options.mode - The response mode: 'json' for API responses or 'redirect' for browser-based flows.
     * @param {string} [options.target] - The destination URL required if mode is set to 'redirect'.
     * @returns {Promise<void>}
     */
    async function finalizeLogin(req, res, next, user, options = { mode: 'json' }) {
        req.logIn(user, async (err) => {
            if (err) return next(err);

            try {
                // Update the last login timestamp in the database.
                // Transaction is omitted here as a simple timestamp update is atomic in Sequelize.
                await server.db.models['user'].registerUserLogin(user.id);
            } catch (dbError) {
                // Log the error but do not block the user from accessing the system.
                console.error('[Auth] Failed to record login timestamp for user ID:', user.id, dbError);
            }

            // Handle different response types based on the login source (e.g., AJAX vs OAuth Redirect).
            if (options.mode === 'redirect') {
                const redirectUrl = options.target || 'http://localhost:3000/dashboard';
                return res.redirect(redirectUrl);
            }

            // Default to JSON response for LDAP or standard AJAX logins.
            return res.status(200).send({ user });
        });
    }

    function ensureAuthenticated(req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        res.status(401).json({ 
            message: 'Authentication required' 
        });
    }

    // ==========================================
    // AUTHENTICATION ROUTES
    // ==========================================

    /**
     * Login Procedure
     */
    server.app.post('/auth/login', function (req, res, next) {
        passport.authenticate('local-login', async function (err, user, info) {
            if (err) {
                server.logger.error("Login failed: " + err);
                return res.status(500).send("Failed to login");
            }
            if (!user) {
                server.logger.info("User not found: " +
                    JSON.stringify(info));
                return res.status(401).send(info);
            }
            
            // Check if email verification is required and if user has verified their email
            const emailVerificationEnabled = await server.db.models['setting'].get("app.register.emailVerification") === "true";
            if (emailVerificationEnabled && !user.emailVerified) {
                return res.status(401).json({
                    message: "Please verify your email address before logging in.",
                    emailNotVerified: true,
                    email: user.email
                });
            }
            
            
            // Start 2FA if configured for this user
            const twoFactorHandled = await startTwoFactorIfConfigured(req, res, user, { mode: 'json' });
            // 2FA response has been sent; stop normal login flow
            if (twoFactorHandled) return;
            
            // No 2FA required, proceed with normal login
            return finalizeLogin(req, res, next, user, { mode:'json'});
        })(req, res, next);
    });

    /**
     * LDAP login method (JSON-based, similar to /auth/login)
     */
    server.app.post('/auth/login/ldap', function (req, res, next) {
        passport.authenticate('ldap-login', async function (err, user, info) {
            if (err) {
                server.logger.error("LDAP login failed: " + err);
                return res.status(500).send("Failed to login");
            }
            if (!user) {
                return res.status(401).send(info || { message: "LDAP login failed." });
            }

            const handled = await startTwoFactorIfConfigured(req, res, user, { mode: 'json' });
            if (handled) return;

            req.logIn(user, async function (err2) {
                if (err2) return next(err2);
                await server.db.models['user'].registerUserLogin(user.id);
                return res.status(200).send({ user: user });
            });
        })(req, res, next);
    });

    /**
     * ORCID login method
     */
    server.app.get('/auth/login/orcid', passport.authenticate('orcid-login'));

    server.app.get('/auth/2fa/orcid/callback',
        passport.authenticate('orcid-login', { failureRedirect: '/login?error=orcid-login-failed' }),
        async function (req, res, next) {
            const user = req.user;
            const handled = await startTwoFactorIfConfigured(req, res, user, { mode: 'redirect'});
            if (handled) return;

            req.logIn(user, async function (err) {
                if (err) return next(err);
                let transaction;
                try {
                    transaction = await server.db.models['user'].sequelize.transaction();
                    await server.db.models['user'].registerUserLogin(user.id, {transaction});
                    await transaction.commit();
                } catch (e) {
                    await transaction.rollback();
                }
                // TODO: The url is for testing only. To be removed later.
                return res.redirect('http://localhost:3000/dashboard');
            });
        }
    );

    /**
     * SAML login method
     */
    server.app.get('/auth/login/saml', passport.authenticate('saml-login'));

    server.app.post('/auth/login/saml/callback',
        passport.authenticate('saml-login', { failureRedirect: '/login?error=saml-login-failed' }),
        async function (req, res, next) {
            const user = req.user;
            const handled = await startTwoFactorIfConfigured(req, res, user, { mode: 'redirect'});
            if (handled) return;

            req.logIn(user, async function (err) {
                if (err) return next(err);
                await server.db.models['user'].registerUserLogin(user.id);
                return res.redirect('/dashboard');
            });
        }
    );

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

    // ==========================================
    // REGISTRATION & EMAIL VERIFICATION ROUTES
    // ==========================================

    /**
     * Register Procedure
     */
    server.app.post('/auth/register', async function (req, res) {

        const data = req.body;

        // Check if self-registration is enabled
        const isSelfRegistrationEnabled = await server.db.models["setting"].get("app.register.enabled");
        if (!isSelfRegistrationEnabled) {
            return res.status(403).json({message: "Self-registration is currently disabled. Please contact an administrator to create an account."});
        }

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
            
            // Check if email verification is enabled
            const emailVerificationEnabled = await server.db.models['setting'].get("app.register.emailVerification") === "true";
            
            const userData = {
                firstName: data.firstName,
                lastName: data.lastName,
                userName: data.userName,
                password: data.password,
                email: data.email,
                acceptTerms: data.acceptTerms,
                acceptStats: data.acceptStats,
                acceptedAt: data.acceptedAt,
            };
            const newUser = await server.db.models['user'].add(userData, {transaction: transaction});
            // Generate email verification token if verification is enabled
            if (emailVerificationEnabled) {
                const tokenExpiry = await getEmailVerificationTokenExpiry();
                const verificationToken = generateToken(tokenExpiry);
                userData.emailVerificationToken = verificationToken;
                await server.db.models['user'].update(
                    {emailVerificationToken: verificationToken}, 
                    {where: {id: newUser.id}, transaction}
                );
                const baseUrl = await getBaseUrl();
                const verificationLink = `http://${baseUrl}/login?token=${verificationToken}`;
                await server.sendMail(
                    data.email, 
                    "Welcome to CARE - Please verify your email address", 
                    `Welcome to CARE, ${data.userName}! You've successfully registered a new account.

To complete your registration, please verify your email address by clicking the link below:
${verificationLink}

This link will expire in ${tokenExpiry} hours. If you didn't create a CARE account, you can safely ignore this email.

Thanks,
The CARE Team`
                );
                await transaction.commit();
                res.status(201).json({message: "User was successfully created. Please check your email to verify your account.", emailVerificationRequired: true}); // TODO: Adjust link as needed   
            } else {
                await transaction.commit();
                res.status(201).send("User was successfully created");
            }
        } catch (err) {
            await transaction.rollback();
            server.logger.error("Cannot create user:", err);
            res.status(400).json({message: "Failed to create user", error: err.message});
        }
    });

    server.app.post('/auth/request-password-reset', async function (req, res) {
        const {email} = req.body;

        if ( await server.db.models['setting'].get("app.login.forgotPassword") !== "true") {
            return res.status(400).json({message: "Password reset is disabled."});
        }
        if (!email) {
            return res.status(400).json({message: "Please provide an email."});
        }
        try {
            
            const user = await server.db.models['user'].findOne({where: {email: email}});
            if (!user) {
                return res.status(401).json({message: "User with this email does not exist."});
            }
            
            // Rate limiting: Check if a password reset email was sent recently
            const RATE_LIMIT_MINUTES = await getPasswordResetRateLimit();
            const rateLimitCheck = checkEmailRateLimit(user, 'passwordReset', RATE_LIMIT_MINUTES);
            if (!rateLimitCheck.allowed) {
                return res.status(400).json({
                    message: `Please wait ${rateLimitCheck.remainingTime} minute(s) before requesting another password reset email.`
                });
            }
            
            const now = new Date();
            
            // Generate token with encoded expiry from settings
            const tokenExpiry = await getPasswordResetTokenExpiry();
            const resetToken = generateToken(tokenExpiry);
            
            // Store the full token and timestamp in the database
            user.resetToken = resetToken;
            user.lastPasswordResetEmailSent = now;
            await user.save();
            
            // Send email with the full encoded token
            const baseUrl = await getBaseUrl();
            const resetLink = `http://${baseUrl}/reset-password?token=${resetToken}`;
            await server.sendMail(user.email, "CARE Password Reset Request", `Hello ${user.userName},

We received a request to reset the password for your CARE account.

To set a new password, please click the link below:
${resetLink}

This link will expire in ${tokenExpiry} hours. If you didn't request a password reset, you can safely ignore this email and your account will remain secure.

Thanks,
The CARE Team`);
            return res.status(200).json({message: "A password reset link has been sent."});
        } catch (err) {
            server.logger.error("Failed to find user:", err);
            return res.status(500).json({message: "Internal server error"});
        }
    });

    server.app.post('/auth/reset-password', async function (req, res) {
        const {token, newPassword} = req.body;
        if(await server.db.models['setting'].get("app.login.forgotPassword") !== "true") {
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
            
            // Find user by the full token stored in database
            const user = await server.db.models['user'].findOne({where: {resetToken: token}});
            if (!user) {
                return res.status(400).json({message: "Invalid token."});
            }
            
            // Reset password using the user model method and clear token
            await server.db.models['user'].resetUserPwd(user.id, newPassword);
            await server.db.models['user'].update({resetToken: null}, {where: {id: user.id}});
            await server.sendMail(user.email, "CARE Password Successfully Reset", `Hello ${user.userName},

Your CARE account password has been successfully reset.

If you initiated this password change, you can now log in with your new password. If you didn't request this password reset, please contact support immediately as your account may have been compromised.

Thanks,
The CARE Team`);
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
                where: {resetToken: token}
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

    /**
     * Email Verification Route
     */
    server.app.get('/verify-email', async function (req, res) {
        const {token} = req.query;
              
        if(await server.db.models['setting'].get("app.register.emailVerification") !== "true") {
            return res.status(400).send({message:"Email verification is disabled."});
        }
        if (!token) {
            return res.status(400).send({message:"Missing token."});
        }
        
        try {
            // Decode and validate token
            const decoded = decodeToken(token);
            
            if (!decoded.isValid) {
                return res.status(400).send({message:"Invalid token format."});
            }
            
            if (decoded.expired) {
                return res.status(400).send({message:"Token has expired."});
            }
            
            // Find user by verification token
            const user = await server.db.models['user'].findOne({
                where: {emailVerificationToken: token}
            });
            
            if (!user) {
                return res.status(400).send({message:"Invalid token."});
            }

            
            // Mark email as verified and clear token
            await server.db.models['user'].update(
                {emailVerified: true, emailVerificationToken: null},
                {where: {id: user.id}}
            );
            // Redirect to login page with success message
            return res.status(200).send({message:"Email successfully verified. You can now log in."});
            
        } catch (error) {
            server.logger.error("Failed to verify email:", error);
            return res.status(500).send({message:"Internal server error"});
        }
    });

    /**
     * Resend Email Verification Route
     */
    server.app.post('/auth/resend-verification', async function (req, res) {
        const {email} = req.body;
        if (!email) {
            return res.status(400).json({message: "Email address is required."});
        }
        
        try {
            // Check if email verification is enabled
            const emailVerificationEnabled = await server.db.models['setting'].get("app.register.emailVerification") === "true";
            if (!emailVerificationEnabled) {
                return res.status(400).json({message: "Email verification is disabled."});
            }
            
            // Find user by email
            const user = await server.db.models['user'].findOne({where: {email: email}});
            if (!user) {
                return res.status(400).json({message: "User with this email does not exist."});
            }
            
            // Check if already verified
            if (user.emailVerified) {
                return res.status(400).json({message: "Email address is already verified."});
            }
            
            // Rate limiting: Check if a verification email was sent recently
            const RATE_LIMIT_MINUTES = await getEmailVerificationRateLimit();
            const rateLimitCheck = checkEmailRateLimit(user, 'verification', RATE_LIMIT_MINUTES);
            if (!rateLimitCheck.allowed) {
                return res.status(400).json({
                    message: `Please wait ${rateLimitCheck.remainingTime} minute(s) before requesting another verification email.`
                });
            }
            
            const now = new Date();
            
            // Generate new verification token
            const tokenExpiry = await getEmailVerificationTokenExpiry();
            const verificationToken = generateToken(tokenExpiry);
            
            // Update user with new token and timestamp
            await server.db.models['user'].update(
                {emailVerificationToken: verificationToken, lastVerificationEmailSent: now},
                {where: {id: user.id}}
            );
            
            // Send verification email
            const baseUrl = await getBaseUrl();
            const verificationLink = `http://${baseUrl}/login?token=${verificationToken}`;
            await server.sendMail(
                email,
                "CARE - Please verify your email address",
                `Welcome back to CARE, ${user.userName}!

To complete your email verification, please click the link below:
${verificationLink}

This link will expire in ${tokenExpiry} hours. If you didn't request this verification email, you can safely ignore this email.

Thanks,
The CARE Team`
            );
            
            return res.status(200).json({message: "Verification email has been sent."});
            
        } catch (error) {
            server.logger.error("Failed to resend verification email:", error);
            return res.status(500).json({message: "Internal server error"});
        }
    });

    // ==========================================
    // 2FA VERIFICATION ROUTES (Login Flow)
    // ==========================================

    /**
     * Select a 2FA method when multiple are configured.
     * If email is selected, the OTP will be sent after selection.
     */
    server.app.post('/auth/2fa/select', async function (req, res) {
        const { method } = req.body;

        if (!req.session || !req.session.twoFactorPending) {
            return res.status(400).json({ message: "No pending 2FA verification found. Please login again." });
        }

        const pending = req.session.twoFactorPending;
        if (!method || !pending.methods || !Array.isArray(pending.methods)) {
            return res.status(400).json({ message: "Missing 2FA method selection." });
        }

        if (!pending.methods.includes(method)) {
            return res.status(400).json({ message: "Selected 2FA method is not enabled for this user." });
        }

        // Load user for any required side effects (email OTP send / totp secret existence)
        const userRecord = await server.db.models['user'].findOne({
            where: { id: pending.userId },
            raw: true,
        });

        if (!userRecord) {
            delete req.session.twoFactorPending;
            return res.status(400).json({ message: "User not found." });
        }

        pending.method = method;
        req.session.twoFactorPending = pending;

        try {
            if (method === 'email') {
                if (!userRecord.email) {
                    return res.status(400).json({ message: "Email address not found. Cannot use email 2FA." });
                }
                await sendEmailOtp(userRecord);
                req.session.save(() => {
                    return res.status(200).json({ requiresTwoFactor: true, method: 'email' });
                });
                return;
            }

            if (method === 'totp') {
                if (!userRecord.totpSecret) {
                    return res.status(400).json({ message: "TOTP is enabled but not configured (missing secret)." });
                }
                req.session.save(() => {
                    return res.status(200).json({ requiresTwoFactor: true, method: 'totp' });
                });
                return;
            }

            return res.status(400).json({ message: `Unsupported 2FA method: ${method}` });
        } catch (e) {
            server.logger.error("Failed to apply 2FA selection: " + e);
            return res.status(500).json({ message: "Failed to start selected 2FA method." });
        }
    });

    /**
     * Verify OTP and complete login
     * Uses session to track 2FA state
     */
    server.app.post('/auth/2fa/email/verify', async function (req, res) {
        const { otp } = req.body;
        
        if (!otp) {
            return res.status(400).json({ message: "OTP is required." });
        }

        // Check if session has 2FA pending state
        if (!req.session || !req.session.twoFactorPending) {
            return res.status(400).json({ message: "No pending 2FA verification found. Please login again." });
        }

        if (req.session.twoFactorPending.method !== 'email') {
            return res.status(400).json({ message: "Email 2FA is not the selected method." });
        }
        
        try {
            const { userId } = req.session.twoFactorPending;

            // Get user details
            const user = await server.db.models['user'].findOne({
                where: { id: userId }
            });

            if (!user) {
                // Clear invalid session state
                delete req.session.twoFactorPending;
                return res.status(400).json({ message: "User not found." });
            }
            
            // Verify OTP
            if (!user.twoFactorOtp || user.twoFactorOtp !== otp) {
                return res.status(401).json({ message: "Invalid OTP code." });
            }
            
            // Check if OTP has expired
            if (!user.twoFactorOtpExpiresAt || new Date() > new Date(user.twoFactorOtpExpiresAt)) {
                await server.db.models['user'].update(
                    { twoFactorOtp: null, twoFactorOtpExpiresAt: null },
                    { where: { id: user.id } }
                );
                // Clear session state
                delete req.session.twoFactorPending;
                return res.status(400).json({ message: "OTP has expired. Please request a new one." });
            }
            
            // OTP is valid - clear OTP from database
            await server.db.models['user'].update(
                { twoFactorOtp: null, twoFactorOtpExpiresAt: null },
                { where: { id: user.id } }
            );
            
            // Complete login
            await completeTwoFactorLogin(req, res, userId);
            
        } catch (error) {
            server.logger.error("Failed to verify OTP: " + error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });

    server.app.post('/auth/2fa/otp/resend', resendEmailOtp);

    /**
     * Verify TOTP and complete login
     */
    server.app.post('/auth/2fa/totp/verify',
        async function (req, res, next) {
            const token = String(req.body.token || '').replace(/\s/g, '');
            if (!token) {
                return res.status(400).json({ message: 'TOTP token is required.' });
            }

            const pending = req.session?.twoFactorPending;
            if (!pending?.userId) {
                return res.status(401).json({ message: 'Invalid TOTP code' });
            }

            try {
                const user = await server.db.models['user'].findOne({
                    where: { id: pending.userId },
                    raw: true,
                });
                if (!user || !user.totpSecret) {
                    return res.status(401).json({ message: 'Invalid TOTP code' });
                }

                const totp = new TOTP({ secret: user.totpSecret, digits: 6, period: 30 });
                if (totp.validate({ token, window: 1 }) === null) {
                    return res.status(401).json({ message: 'Invalid TOTP code' });
                }

                // Complete login
                await completeTwoFactorLogin(req, res, pending.userId);
                
            } catch (err) {
                return next(err);
            }
        }
    );

    /**
     * Initiate TOTP setup (authenticated user).
     */
    server.app.post('/auth/2fa/totp/setup/initiate', ensureAuthenticated, async function (req, res) {
        const user = await server.db.models['user'].findOne({ where: { id: req.user.id }, raw: true });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const secret = new Secret({ size: 20 });
        const secretBase32 = secret.base32;
        const totp = new TOTP({
            issuer: 'CARE',
            label: `CARE (${user.userName})`,
            secret,
            digits: 6,
            period: 30,
        });
        const otpauthUrl = totp.toString();

        req.session.totpSetupPending = {
            secretBase32: secretBase32,
        };

        req.session.save((err) => {
            if (err) {
                server.logger.error("Failed to save session for TOTP setup: " + err);
                return res.status(500).json({ message: "Failed to initiate TOTP setup." });
            }
            return res.status(200).json({
                otpauthUrl: otpauthUrl,
                secretBase32: secretBase32,
            });
        });
    });
    
    /**
     * Verify TOTP setup (authenticated user) and persist secret.
     */
    server.app.post('/auth/2fa/totp/setup/verify',
        ensureAuthenticated,
        async function (req, res, next) {
            const { token } = req.body;

            if (!token) {
                return res.status(400).json({ message: "TOTP token is required." });
            }

            if (!req.session?.totpSetupPending?.secretBase32) {
                return res.status(400).json({
                    message: "No pending TOTP setup found."
                });
            }

            const secretBase32 = req.session.totpSetupPending.secretBase32;
            const originalUserId = req.user.id;

            const totp = new TOTP({ secret: secretBase32, digits: 6, period: 30 });
            if (totp.validate({ token: String(token).trim(), window: 1 }) === null) {
                return res.status(401).json({ message: "Invalid TOTP code." });
            }

            try {
                const dbUser = await server.db.models['user'].findOne({
                    where: { id: originalUserId }
                });

                if (!dbUser) {
                    return res.status(404).json({ message: "User not found." });
                }

                const currentMethods = Array.isArray(dbUser.twoFactorMethods)
                    ? [...dbUser.twoFactorMethods]
                    : [];
                if (!currentMethods.includes('totp')) {
                    currentMethods.push('totp');
                }

                await server.db.models['user'].update(
                    {
                        totpSecret: secretBase32,
                        twoFactorMethods: currentMethods
                    },
                    { where: { id: dbUser.id } }
                );

                delete req.session.totpSetupPending;

                return res.status(200).json({
                    message: "TOTP configured successfully.",
                    twoFactorMethods: currentMethods
                });
            } catch (err) {
                return next(err);
            }
        }
    );

    /**
     * Get 2FA status for current user
     */
    server.app.get('/auth/2fa/status', async function (req, res) {
        if (!req.user) {
            return res.status(401).json({ message: "You must be logged in to check 2FA status." });
        }
        
        try {
            const user = await server.db.models['user'].findOne({
                where: { id: req.user.id },
                attributes: [
                    'twoFactorMethods',
                    'totpSecret',
                    'email',
                    'orcidId',
                    'ldapDomain'
                ]
            });
            
            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }
            
            const methods = getTwoFactorMethods(user);
            const hasTotp = methods.includes('totp') && !!user.totpSecret;
            
            return res.status(200).json({
                twoFactorMethods: methods,
                hasEmail: methods.includes('email'),
                hasTotp: hasTotp,
                email: user.email || null,
                orcidId: user.orcidId || null,
                ldapDomain: user.ldapDomain || null,
            });
            
        } catch (error) {
            server.logger.error("Failed to get 2FA status: " + error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });

    /**
     * Enable 2FA for a user
     */
    server.app.post('/auth/2fa/enable', async function (req, res) {
        if (!req.user) {
            return res.status(401).json({ message: "You must be logged in to enable 2FA." });
        }
        
        const { method } = req.body;

        // Supported 2FA methods: email and totp
        if (!method || !['email', 'totp'].includes(method)) {
            return res.status(400).json({ message: "Valid 2FA method is required (email or totp)." });
        }
        
        try {
            const user = await server.db.models['user'].findOne({
                where: { id: req.user.id }
            });
            
            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }
            
            if (method === 'email' && !user.email) {
                return res.status(400).json({ message: "Email address is required to enable email 2FA." });
            }

            if (method === 'totp') {
                return res.status(400).json({ message: "Use /auth/2fa/totp/setup/initiate and /auth/2fa/totp/setup/verify to enable TOTP (requires setup + verification)." });
            }

            // Compute updated list of 2FA methods
            const currentMethods = Array.isArray(user.twoFactorMethods) ? user.twoFactorMethods.slice() : [];
            if (!currentMethods.includes(method)) {
                currentMethods.push(method);
            }

            const updateData = {
                twoFactorMethods: currentMethods,
            };

            // Enable 2FA
            await server.db.models['user'].update(
                updateData,
                { where: { id: user.id } }
            );
            
            return res.status(200).json({ 
                message: `2FA has been enabled with ${method} method.`,
                twoFactorMethods: currentMethods,
            });
            
        } catch (error) {
            server.logger.error("Failed to enable 2FA: " + error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });

    /**
     * Disable a specific 2FA method for the current user.
     * If this was the last enabled method, 2FA is fully disabled and related fields are cleared.
     */
    server.app.post('/auth/2fa/disable/:method', ensureAuthenticated, async function (req, res) {
        const method = req.params.method;

        // TODO: Methods are hard coded now. Could they be dynamic?
        if (!['email', 'totp'].includes(method)) {
            return res.status(400).json({ message: "Valid 2FA method is required (email or totp)." });
        }

        try {
            const user = await server.db.models['user'].findOne({
                where: { id: req.user.id }
            });

            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }

            const currentMethods = getTwoFactorMethods(user);

            if (!currentMethods.includes(method)) {
                return res.status(400).json({ message: `2FA method '${method}' is not enabled for this user.` });
            }

            const updatedMethods = currentMethods.filter((m) => m !== method);

            const updateData = {
                twoFactorMethods: updatedMethods,
            };

            // If we remove email, clear any pending email OTP state
            if (method === 'email') {
                updateData.twoFactorOtp = null;
                updateData.twoFactorOtpExpiresAt = null;
            }

            // If we remove TOTP, clear the TOTP secret
            if (method === 'totp') {
                updateData.totpSecret = null;
            }

            // If no methods remain, fully disable 2FA state
            if (updatedMethods.length === 0) {
                updateData.twoFactorOtp = null;
                updateData.twoFactorOtpExpiresAt = null;
                updateData.totpSecret = null;
            }

            await server.db.models['user'].update(
                updateData,
                { where: { id: user.id } }
            );

            return res.status(200).json({
                message: `2FA method '${method}' has been disabled.`,
                twoFactorMethods: updatedMethods,
            });

        } catch (error) {
            server.logger.error("Failed to disable 2FA method: " + error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });
}
