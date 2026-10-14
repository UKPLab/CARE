'use strict';

const {
    generateSecret,
    hashSecret,
    displayPrefixFromSecret,
    isApiTokensEnabled,
    hasOnlyGuestRole,
    ownerIsAdmin,
    listAttachableRights,
} = require('../../utils/apiTokenAuth');

function publicTokenRow(token) {
    return {
        id: token.id,
        userId: token.userId,
        name: token.name,
        prefix: token.prefix,
        lastUsedAt: token.lastUsedAt,
        createdAt: token.createdAt,
    };
}

/**
 * Cookie-authenticated token mint/list/revoke. Scripts never call these paths.
 */
function registerApiTokenRoutes(server, helpers) {
    const {shared} = helpers;
    const models = server.db.models;

    async function requireEnabled(req, res) {
        const enabled = isApiTokensEnabled(
            await models['setting'].get('system.auth.apiTokens.enabled')
        );
        if (!enabled) {
            res.status(403).json({message: 'errors.rest.apiTokensDisabled'});
            return false;
        }
        return true;
    }

    server.app.get('/auth/api-tokens', shared.ensureAuthenticated, async (req, res) => {
        try {
            if (!(await requireEnabled(req, res))) {
                return;
            }
            const admin = await ownerIsAdmin(models, req.user.id);
            const where = {deleted: false};
            if (!admin) {
                where.userId = req.user.id;
            }
            const tokens = await models['api_token'].findAll({
                where,
                attributes: {exclude: ['keyHash']},
                order: [['createdAt', 'DESC']],
                raw: true,
            });
            return res.status(200).json({tokens: tokens.map(publicTokenRow)});
        } catch (err) {
            server.logger.error('List api tokens failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.post('/auth/api-tokens', shared.ensureAuthenticated, async (req, res) => {
        const t = await server.db.sequelize.transaction();
        try {
            if (!(await requireEnabled(req, res))) {
                await t.rollback();
                return;
            }
            if (await hasOnlyGuestRole(models, req.user.id)) {
                await t.rollback();
                return res.status(403).json({message: 'errors.rest.guestCannotCreateToken'});
            }

            const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
            if (!name) {
                await t.rollback();
                return res.status(400).json({message: 'errors.rest.tokenNameRequired'});
            }

            const attachable = await listAttachableRights(models, req.user.id);
            let rights = attachable;
            if (Array.isArray(req.body?.rights)) {
                const requested = req.body.rights.filter((item) => typeof item === 'string');
                const extra = requested.filter((right) => !attachable.includes(right));
                if (extra.length) {
                    await t.rollback();
                    return res.status(403).json({message: 'errors.rest.cannotGrantMissingRight'});
                }
                rights = requested;
            }

            const secret = generateSecret();
            const token = await models['api_token'].add({
                userId: req.user.id,
                name,
                keyHash: hashSecret(secret),
                prefix: displayPrefixFromSecret(secret),
            }, {transaction: t});

            for (const userRightName of rights) {
                await models['api_token_right'].add({
                    apiTokenId: token.id,
                    userRightName,
                    deleted: false,
                }, {transaction: t});
            }

            await t.commit();
            return res.status(201).json({
                token: publicTokenRow(token),
                secret,
            });
        } catch (err) {
            try {
                await t.rollback();
            } catch (_rollbackError) {
                // already rolled back
            }
            server.logger.error('Create api token failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });

    server.app.delete('/auth/api-tokens/:id', shared.ensureAuthenticated, async (req, res) => {
        try {
            if (!(await requireEnabled(req, res))) {
                return;
            }
            const id = Number(req.params.id);
            if (!Number.isInteger(id)) {
                return res.status(400).json({message: 'errors.rest.invalidTokenId'});
            }
            const token = await models['api_token'].getById(id);
            if (!token) {
                return res.status(404).json({message: 'errors.rest.tokenNotFound'});
            }
            const admin = await ownerIsAdmin(models, req.user.id);
            if (token.userId !== req.user.id && !admin) {
                return res.status(403).json({message: 'errors.rest.cannotRevokeForeignToken'});
            }
            await models['api_token'].deleteById(id);
            return res.status(200).json({success: true});
        } catch (err) {
            server.logger.error('Revoke api token failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });
}

module.exports = {registerApiTokenRoutes};
