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
     * Helper function to normalize base URLs.
     * Ensures protocol is present and strips trailing slashes.
     * @param {string} value
     * @param {string} fallback
     * @returns {string}
     */
    function normalizeBaseUrl(value, fallback) {
        const rawValue = (value || fallback || "").trim();
        const withProtocol = /^https?:\/\//i.test(rawValue) ? rawValue : `http://${rawValue}`;
        return withProtocol.replace(/\/+$/, "");
    }

    /**
     * Helper function to get frontend base URL used for auth redirects.
     */
    async function getFrontendBaseUrl() {
        const frontendBaseUrl = await server.db.models['setting'].get("system.auth.redirect.baseUrl");
        return normalizeBaseUrl(frontendBaseUrl, "http://localhost:3000");
    }

    /**
     * Build a frontend URL from base URL, path, and optional query object.
     * @param {string} frontendBaseUrl
     * @param {string} path
     * @param {Object} query
     * @returns {string}
     */
    function buildFrontendUrl(frontendBaseUrl, path, query = {}) {
        const safePath = `/${(path || "").replace(/^\/+/, "")}`;
        const queryString = new URLSearchParams(
            Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== "")
        ).toString();
        return queryString
            ? `${frontendBaseUrl}${safePath}?${queryString}`
            : `${frontendBaseUrl}${safePath}`;
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
        if (!user) return [];

        if (Array.isArray(user.twoFactorMethods)) {
            return user.twoFactorMethods.filter((m) => !!m);
        }

        return [];
    }

    async function isLoginMethodEnabled(method) {
        return (await server.db.models['setting'].get(`system.auth.loginMethods.${method}.enabled`)) === "true";
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
     * Start 2FA login flow.
     * - If exactly 1 method is configured: start it immediately (send email OTP if needed).
     * - If multiple methods are configured: require the client to select one via /auth/2fa/select.
     *
     * Returns true if a response has been sent (2FA flow started / selection required).
     */
    async function startTwoFactorLogin(req, res, userId, options = { mode: 'json' }) {
        const mode = options.mode || 'json';
    
        // 1.Get user record and 2fa methods
        const dbUser = await server.db.models['user'].findByPk(userId, { raw: true });
        if (!dbUser) return false;
    
        const methods = getTwoFactorMethods(dbUser);
        if (!methods || methods.length === 0) return false;
    
        // 2. Initialize 2FA Session
        req.session.twoFactorPending = {
            userId: dbUser.id,
            methods: methods,
            method: null
        };
    
        let responseData = { requiresTwoFactor: true, methods };
        let redirectPath = "/2fa/select";
    
        // 3. Handle single method vs multiple methods
        if (methods.length === 1) {
            const method = methods[0];
            req.session.twoFactorPending.method = method;
    
            try {
                // Execute 2fa relevant operation
                await performTwoFactorAction(dbUser, method);
                
                // Set results for a single 2FA method
                responseData.selectionRequired = false;
                responseData.method = method;
                redirectPath = getTwoFactorRedirectPath(method);
            } catch (err) {
                server.logger.error(`2FA Initialization failed: ${err.message}`);
                return res.status(err.status || 500).json({ message: err.message });
            }
        } else {
            // Multiple methods available; requiring frontend to display selection page
            responseData.selectionRequired = true;
        }
    
        // 4. Unified handling of session persistence and response
        const frontendBaseUrl = mode === "redirect" ? await getFrontendBaseUrl() : null;
        
        req.session.save((err) => {
            if (err) {
                server.logger.error("Failed to save session: " + err);
                return res.status(500).json({ message: "Session error during 2FA." });
            }
    
            if (mode === 'redirect') {
                const finalUrl = buildFrontendUrl(frontendBaseUrl, redirectPath);
                return res.redirect(finalUrl);
            }
            return res.status(200).json(responseData);
        });
    
        return true;
    }
    
    async function performTwoFactorAction(user, method) {
        if (method === 'email') {
            if (!user.email) {
                throw { status: 400, message: "Email not found for this user." };
            }
            await sendEmailOtp(user);
        } else if (method === 'totp') {
            if (!user.totpSecret) {
                throw { status: 400, message: "TOTP is not configured." };
            }
        } else {
            throw { status: 400, message: `Unsupported 2FA method: ${method}` };
        }
    }
    
    /**
     * Map redirect paths
     */
    function getTwoFactorRedirectPath(method) {
        const paths = { 
            email: "/2fa/verify/email",
            totp: "/2fa/verify/totp"
        };
        return paths[method] || "/login?error=unsupported-method";
    }

    /**
     * Finalizes the authentication process by establishing a passport session, 
     * updating login records, and handling the HTTP response.
     * @param {Object} req - The Express request object.
     * @param {Object} res - The Express response object.
     * @param {Object} user - The user object to be logged in.
     * @param {Object} options - Configuration for the response.
     * @param {string} [options.mode='json'] - The response mode: 'json' or 'redirect'.
     * @param {string} [options.redirectPath='/dashboard'] - The path to redirect to if mode is 'redirect'.
     * @returns {Promise<void>}
     */
    async function finalizeLogin(req, res, user, options = { mode: 'json', redirectPath: '/dashboard' }) {
        const mode = options.mode || 'json';
        
        // 1. Establish the Passport session
        req.logIn(user, async (err) => {
            if (err) {
                server.logger.error(`[Auth] Passport login failed for user ${user.id}: ${err}`);
                return res.status(500).json({ message: "Failed to establish login session." });
            }

            // 2. Cleanup: Remove 2FA pending state if it exists
            if (req.session.twoFactorPending) {
                delete req.session.twoFactorPending;
            }

            // 3. Post-login activities (Non-blocking database updates)
            try {
                // Standardizing the login registration logic
                await server.db.models['user'].registerUserLogin(user.id);
            } catch (dbError) {
                server.logger.error(`[Auth] Failed to record login activity for user ${user.id}: ${dbError}`);
            }

            // 4. Ensure session is persisted before responding
            req.session.save(async (saveErr) => {
                if (saveErr) {
                    server.logger.error(`[Auth] Session save failed for user ${user.id}: ${saveErr}`);
                }

                if (mode === 'redirect') {
                    const frontendBaseUrl = await getFrontendBaseUrl();
                    const finalUrl = buildFrontendUrl(frontendBaseUrl, options.redirectPath);
                    return res.redirect(finalUrl);
                }

                return res.status(200).json({ user });
            });
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
            const twoFactorHandled = await startTwoFactorLogin(req, res, user.id, { mode: 'json' });
            // 2FA response has been sent; stop normal login flow
            if (twoFactorHandled) return;
            
            // No 2FA required, proceed with normal login
            return finalizeLogin(req, res, user, { mode: 'json' });
        })(req, res, next);
    });

    /**
     * LDAP login method (JSON-based, similar to /auth/login)
     */
    server.app.post('/auth/login/ldap', async function (req, res, next) {
        if (!(await isLoginMethodEnabled('ldap'))) {
            return res.status(403).json({ message: "LDAP login is disabled by the administrator." });
        }
        if (!server.isAuthProviderReady('ldap')) {
            const status = server.getAuthProviderStatus('ldap');
            return res.status(503).json({
                message: "LDAP login is enabled but not fully configured. Please contact an administrator.",
                reason: status.reason
            });
        }
        passport.authenticate('ldap-login', async function (err, user, info) {
            if (err) {
                server.logger.error("LDAP login failed: " + err);
                return res.status(500).send("Failed to login");
            }
            if (!user) {
                return res.status(401).send(info || { message: "LDAP login failed." });
            }

            const handled = await startTwoFactorLogin(req, res, user.id, { mode: 'json' });
            if (handled) return;

            return finalizeLogin(req, res, user, { mode:'json'});
        })(req, res, next);
    });

    /**
     * ORCID login method
     */
    server.app.get('/auth/login/orcid', async function (req, res, next) {
        const frontendBaseUrl = await getFrontendBaseUrl();
        if (!(await isLoginMethodEnabled('orcid'))) {
            return res.redirect(buildFrontendUrl(frontendBaseUrl, "/login", { error: "orcid-login-disabled" }));
        }
        if (!server.isAuthProviderReady('orcid')) {
            const status = server.getAuthProviderStatus('orcid');
            server.logger.warn(`[Auth] ORCID requested but provider is not ready (${status.reason}).`);
            return res.redirect(buildFrontendUrl(frontendBaseUrl, "/login", { error: "orcid-login-not-ready" }));
        }
        return passport.authenticate('orcid-login')(req, res, next);
    });

    server.app.get('/auth/2fa/orcid/callback',
        async function (req, res, next) {
            const frontendBaseUrl = await getFrontendBaseUrl();
            if (!(await isLoginMethodEnabled('orcid'))) {
                return res.redirect(buildFrontendUrl(frontendBaseUrl, "/login", { error: "orcid-login-disabled" }));
            }
            if (!server.isAuthProviderReady('orcid')) {
                const status = server.getAuthProviderStatus('orcid');
                server.logger.warn(`[Auth] ORCID callback hit but provider is not ready (${status.reason}).`);
                return res.redirect(buildFrontendUrl(frontendBaseUrl, "/login", { error: "orcid-login-not-ready" }));
            }
            const failureRedirect = buildFrontendUrl(frontendBaseUrl, "/login", { error: "orcid-login-failed" });
            return passport.authenticate('orcid-login', { failureRedirect })(req, res, next);
        },
        async function (req, res, next) {
            const user = req.user;
            const handled = await startTwoFactorLogin(req, res, user.id, { mode: 'redirect'});
            if (handled) return;

            return finalizeLogin(req, res, user, { mode:'redirect'});
        }
    );

    /**
     * SAML login method
     */
    server.app.get('/auth/login/saml', async function (req, res, next) {
        const frontendBaseUrl = await getFrontendBaseUrl();
        if (!(await isLoginMethodEnabled('saml'))) {
            return res.redirect(buildFrontendUrl(frontendBaseUrl, "/login", { error: "saml-login-disabled" }));
        }
        if (!server.isAuthProviderReady('saml')) {
            const status = server.getAuthProviderStatus('saml');
            server.logger.warn(`[Auth] SAML requested but provider is not ready (${status.reason}).`);
            return res.redirect(buildFrontendUrl(frontendBaseUrl, "/login", { error: "saml-login-not-ready" }));
        }
        return passport.authenticate('saml-login')(req, res, next);
    });

    server.app.post('/auth/login/saml/callback',
        async function (req, res, next) {
            const frontendBaseUrl = await getFrontendBaseUrl();
            if (!(await isLoginMethodEnabled('saml'))) {
                return res.redirect(buildFrontendUrl(frontendBaseUrl, "/login", { error: "saml-login-disabled" }));
            }
            if (!server.isAuthProviderReady('saml')) {
                const status = server.getAuthProviderStatus('saml');
                server.logger.warn(`[Auth] SAML callback hit but provider is not ready (${status.reason}).`);
                return res.redirect(buildFrontendUrl(frontendBaseUrl, "/login", { error: "saml-login-not-ready" }));
            }
            const failureRedirect = buildFrontendUrl(frontendBaseUrl, "/login", { error: "saml-login-failed" });
            return passport.authenticate('saml-login', function (err, user, info) {
                if (err) {
                    server.logger.error(`[Auth] SAML authentication error: ${err.message}`);
                    return res.redirect(failureRedirect);
                }

                if (!user) {
                    const infoMessage = info?.message || "Unknown SAML authentication failure.";
                    server.logger.warn(`[Auth] SAML authentication failed: ${infoMessage}`);
                    return res.redirect(failureRedirect);
                }

                return req.logIn(user, function (loginErr) {
                    if (loginErr) {
                        server.logger.error(`[Auth] SAML session login error: ${loginErr.message}`);
                        return res.redirect(failureRedirect);
                    }
                    return next();
                });
            })(req, res, next);
        },
        async function (req, res, next) {
            const user = req.user;
            const handled = await startTwoFactorLogin(req, res, user.id, { mode: 'redirect'});
            if (handled) return;

            return finalizeLogin(req, res, user, { mode: 'redirect'});
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
            return finalizeLogin(req, res, user, { mode: 'json' });
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
                return finalizeLogin(req, res, user, { mode: 'json' });
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
                    'orcidId'
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
