/**
 * Setup wizard routes. GET /setup/config returns needsSetup, steps, wizardSettings, and
 * wizardSettingsByStep when no admin exists (first-time setup) or when ?reRun=true with an
 * authenticated admin (re-run wizard). When setup is not needed, returns empty steps and settings.
 *
 * @author Mohammad Elwan
 */

/**
 * Register setup routes
 * @param {import("../Server").Server} server
 */
module.exports = function (server) {
    /**
     * GET /setup/config
     * Returns wizard config for first-time setup or re-run. needsSetup is true when no admin exists.
     * When setup is needed (or reRun=true with an admin): steps, wizardSettings,
     * and wizardSettingsByStep (grouped by general, mail, registration, moodle).
     * When setup is not needed: empty steps and wizardSettings.
     */
    server.app.get("/setup/config", async function (req, res) {
        try {
            const admins = await server.db.models["user"].getUsersByRole("admin");
            const needsSetup = admins.length === 0;

            // reRun=true: admin only; return steps, wizardSettings, wizardSettingsByStep for re-run.
            if (req.query.reRun === "true" && req.user) {
                const isAdmin = admins.some((a) => a.id === req.user.id);
                if (isAdmin) {
                    const WizardStep = server.db.models["wizard_step"];
                    const steps = await WizardStep.findAll({
                        where: { deleted: false },
                        order: [["order", "ASC"]],
                        attributes: ["key", "title", "description", "type", "order"],
                        raw: true,
                    });
                    const wizardSettings = await server.db.models["setting"].getWizardSettings();
                    const wizardSettingsByStep = await server.db.models["setting"].getWizardSettingsByStep();
                    return res.status(200).json({ needsSetup: false, steps, wizardSettings, wizardSettingsByStep });
                }
            }

            if (!needsSetup) {
                return res.status(200).json({ needsSetup: false, steps: [], wizardSettings: [] });
            }

            const WizardStep = server.db.models["wizard_step"];
            const steps = await WizardStep.findAll({
                where: { deleted: false },
                order: [["order", "ASC"]],
                attributes: ["key", "title", "description", "type", "order"],
                raw: true,
            });

            const wizardSettings = await server.db.models["setting"].getWizardSettings();
            const wizardSettingsByStep = await server.db.models["setting"].getWizardSettingsByStep();

            return res.status(200).json({ needsSetup: true, steps, wizardSettings, wizardSettingsByStep });
        } catch (err) {
            server.logger.error("GET /setup/config error: " + err);
            return res.status(500).json({ message: "Internal server error." });
        }
    });

    /**
     * PATCH /setup/state
     * Updates wizard state in app_state.
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
            const AppState = server.db.models["app_state"];

            if (wizardCompleted !== undefined) {
                await AppState.set("setup.wizardCompleted", String(wizardCompleted));
            }
            if (wizardCurrentStep !== undefined) {
                await AppState.set("setup.wizardCurrentStep", String(wizardCurrentStep));
            }

            return res.status(200).json({ success: true });
        } catch (err) {
            server.logger.error("PATCH /setup/state error: " + err);
            return res.status(500).json({ message: "Internal server error." });
        }
    });
};
