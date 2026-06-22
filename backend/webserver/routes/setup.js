/**
 * Setup wizard routes. GET /setup/config returns needsSetup, steps, wizardSettings, and
 * wizardSettingsByStep while initial setup is in progress. Once an admin exists and the
 * wizard is marked complete, returns empty steps and settings.
 *
 * @author Mohammad Elwan
 */

/**
 * Register setup routes
 * @param {import("../Server").Server} server
 */
module.exports = function (server) {
    const mailTest = require("../utils/mailTest.js");
    const { saveSettings } = require("../utils/settingSave.js");
    /**
     * GET /setup/config
     * Returns wizard config while initial setup is in progress: needsSetup is true when no
     * admin exists; steps, wizardSettings, and wizardSettingsByStep (grouped by general,
     * mail, registration) are returned until app.setup.wizardCompleted is true.
     * Each step includes typeId (FK to wizard_step_type). wizardStepTypes lists id for setup UI.
     * Moodle fields appear in the General wizard step in the UI. When setup is fully
     * complete, returns empty steps and wizardSettings.
     */
    server.app.get("/setup/config", async function (req, res) {
        try {
            const admins = await server.db.models["user"].getUsersByRole("admin");
            const needsSetup = admins.length === 0;
            const wizardCompleted = (await server.db.models["setting"].get("app.setup.wizardCompleted")) === "true";

            if (!needsSetup && wizardCompleted) {
                return res.status(200).json({
                    needsSetup: false,
                    steps: [],
                    wizardSettings: [],
                    wizardStepTypes: [],
                });
            }

            const WizardStep = server.db.models["wizard_step"];
            const WizardStepType = server.db.models["wizard_step_type"];
            const stepRows = await WizardStep.findAll({
                where: { deleted: false },
                order: [["order", "ASC"]],
                attributes: ["key", "title", "description", "order", "wizardStepTypeId"],
                raw: true,
            });
            const steps = stepRows.map((row) => {
                const { wizardStepTypeId, ...rest } = row;
                return { ...rest, typeId: wizardStepTypeId };
            });

            const wizardStepTypes = await WizardStepType.findAll({
                attributes: ["id", "key"],
                order: [["id", "ASC"]],
                raw: true,
            });

            const wizardSettings = await server.db.models["setting"].getWizardSettings();
            const wizardSettingsByStep = await server.db.models["setting"].getWizardSettingsByStep();
            const allSettings = await server.db.models["setting"].getAll(false);

            return res.status(200).json({
                needsSetup,
                steps,
                wizardStepTypes,
                wizardSettings,
                wizardSettingsByStep,
                allSettings,
            });
        } catch (err) {
            server.logger.error("GET /setup/config error: " + err);
            return res.status(500).json({ message: "Internal server error." });
        }
    });

    /**
     * POST /setup/test-mail
     * Sends a fixed test message using mail settings from DB with optional body.settings overrides.
     * Only allowed while needsSetup is true (no admin account).
     */
    server.app.post("/setup/test-mail", async function (req, res) {
        try {
            const admins = await server.db.models["user"].getUsersByRole("admin");
            if (admins.length > 0) {
                return res.status(403).json({ success: false, message: "Test mail is only available during initial setup." });
            }

            const rows = await server.db.models["setting"].getMailServiceSettings();
            const baseMap = mailTest.buildMailMapFromSettingsRows(rows);
            const overlay = req.body && req.body.settings && typeof req.body.settings === "object" && !Array.isArray(req.body.settings)
                ? req.body.settings
                : {};
            const map = { ...baseMap };
            for (const [k, v] of Object.entries(overlay)) {
                if (k && String(k).startsWith("system.mailService.")) {
                    map[String(k)] = v != null && v !== undefined ? String(v) : "";
                }
            }

            const transport = mailTest.buildTransportFromMailSettings(map);
            const from = map["system.mailService.senderAddress"] || "";
            const to = req.body && req.body.to != null ? String(req.body.to).trim() : "";
            await mailTest.sendFixedTestMail(transport, { from, to });
            return res.status(200).json({ success: true, message: "Test email sent." });
        } catch (err) {
            server.logger.error("POST /setup/test-mail error: " + err);
            return res.status(400).json({ success: false, message: err?.message || "Failed to send test email." });
        }
    });

    /**
     * PATCH /setup/state
     * Updates wizard state in settings.
     * Body: { wizardCompleted?: string, wizardCurrentStep?: string }
     */
    server.app.patch("/setup/state", async function (req, res) {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required." });
        }
        try {
            const admins = await server.db.models["user"].getUsersByRole("admin");
            const isAdmin = admins.some((a) => a.id === req.user.id);
            if (!isAdmin) {
                return res.status(403).json({ message: "Admin access required." });
            }

            const { wizardCompleted, wizardCurrentStep } = req.body || {};
            const Setting = server.db.models["setting"];

            if (wizardCompleted !== undefined) {
                await Setting.set("app.setup.wizardCompleted", String(wizardCompleted));
            }
            if (wizardCurrentStep !== undefined) {
                await Setting.set("app.setup.wizardCurrentStep", String(wizardCurrentStep));
            }

            return res.status(200).json({ success: true });
        } catch (err) {
            server.logger.error("PATCH /setup/state error: " + err);
            return res.status(500).json({ message: "Internal server error." });
        }
    });

    /**
     * POST /setup/complete
     * Saves wizard settings and marks setup complete in one flow.
     */
    server.app.post("/setup/complete", async function (req, res) {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required." });
        }
        const settings = req.body && Array.isArray(req.body.settings) ? req.body.settings : null;
        if (!settings) {
            return res.status(400).json({ message: "A settings array is required." });
        }
        try {
            const admins = await server.db.models["user"].getUsersByRole("admin");
            const isAdmin = admins.some((a) => a.id === req.user.id);
            if (!isAdmin) {
                return res.status(403).json({ message: "Admin access required." });
            }

            const transaction = await server.db.sequelize.transaction();
            try {
                const { touchesMailService } = await saveSettings(server.db.models["setting"], settings, {
                    transaction,
                    models: server.db.models,
                });
                await server.db.models["setting"].set("app.setup.wizardCompleted", "true", { transaction });
                await transaction.commit();
                if (touchesMailService) {
                    await server.initMailServer();
                }
            } catch (err) {
                await transaction.rollback();
                throw err;
            }

            return res.status(200).json({ success: true });
        } catch (err) {
            server.logger.error("POST /setup/complete error: " + err);
            return res.status(500).json({ message: "Internal server error." });
        }
    });
};
