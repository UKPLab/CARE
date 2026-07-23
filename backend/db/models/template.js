'use strict';
const MetaModel = require("../MetaModel.js");
const { assertStableEmailTemplateContent } = require("../../utils/helper/templateResolver");

module.exports = (sequelize, DataTypes) => {
    /**
   * Template model
   * Stores reusable templates
   */
    class Template extends MetaModel {
        static autoTable = true;

        /**
         * Get the user filter for templates based on userId and admin status
         * This can be used by Socket.js to apply filtering consistently
         * @param {number} userId - The user ID
         * @param {boolean} isAdmin - Whether the user is an admin
         * @returns {Object} Sequelize filter object
         */
        static getUserFilter(userId, isAdmin) {
            const {Op} = require("sequelize");
            
            if (isAdmin) {
                // Admins: own templates (all types) OR public templates from others
                return {[Op.or]: [{userId: userId}, {public: true}]};
            } else {
                // Non-admins: own templates (types 4, 5 only) OR public templates from others (types 4, 5 only)
                // Email templates (types 1, 2, 3, 6) are admin-only
                return {
                    [Op.or]: [
                        {[Op.and]: [{userId: userId}, {type: {[Op.in]: [4, 5]}}]},
                        {[Op.and]: [{public: true}, {type: {[Op.in]: [4, 5]}}]}
                    ]
                };
            }
        }

        /**
         * Optionally expand the broadcast filter for a given user.
         * For templates, non-admins should also receive updates to
         * templates that are the source of their copies (for "Update available").
         *
         * @param {Object} baseFilter - The filter produced by Socket.js for this user/table
         * @param {number} userId - The user ID
         * @param {boolean} isAdmin - Whether the user is an admin
         * @returns {Promise<Object>} 
         */
        static async expandBroadcastFilter(baseFilter, userId, isAdmin) {
            const {Op} = require("sequelize");
            if (isAdmin || !baseFilter[Op.or]) {
                return baseFilter;
            }
            const copies = await Template.findAll({
                where: { userId, sourceId: { [Op.ne]: null }, deleted: false },
                attributes: ["sourceId"],
                raw: true,
            });
            const sourceIds = copies.map((c) => c.sourceId).filter(Boolean);
            if (sourceIds.length === 0) {
                return baseFilter;
            }
            const orList = Array.isArray(baseFilter[Op.or]) ? [...baseFilter[Op.or]] : [baseFilter[Op.or]];
            orList.push({ id: { [Op.in]: sourceIds } });
            return { ...baseFilter, [Op.or]: orList };
        }

        /**
         * Override getAutoTable to apply custom filtering for templates:
         * - All users (including admins): own templates OR public templates from others
         * - Non-admins: exclude email templates (types 1, 2, 3, 6) - admin-only
         */
        static async getAutoTable(filterList = [], userId = null, attributes = null) {
            const {Op} = require("sequelize");
            
            let filter = {deleted: false}; 
            
            for (let filterItem of filterList) {
                if (filterItem.key in this.getAttributes() && filterItem.key !== 'userId') {
                    if (filterItem.values && filterItem.values.length > 0) {
                        filter[filterItem.key] = {[Op.or]: filterItem.values};
                    } else {
                        if (filterItem.type === "not") {
                            filter[filterItem.key] = {[Op.not]: filterItem.value};
                        } else {
                            filter[filterItem.key] = filterItem.value;
                        }
                    }
                }
            }
            
            if (userId && 'userId' in this.getAttributes()) {
                let isAdmin = false;
                try {
                    const roleIds = await sequelize.models.user_role_matching.getUserRolesById(userId);
                    isAdmin = await sequelize.models.user_role_matching.isAdminInUserRoles(roleIds);
                } catch (err) {
                    console.warn("Could not determine admin status for user", userId, err);
                }
                
                const userFilter = this.getUserFilter(userId, isAdmin);
                Object.assign(filter, userFilter);
            }
            
            let options = {where: filter, raw: true};
            if (attributes && attributes.length > 0) {
                options.attributes = [...new Set([...attributes, 'id'])];
            }

            return await this.findAll(options);
        }

        static fields = [
            {
                key: "name",
                label: "Name",
                type: "text",
                required: true,
            },
            {
                key: "description",
                label: "Description",
                type: "textarea",
                required: true
            },
            // Published field is excluded from form (handled via table action buttons only)
            {
                key: "type",
                label: "Type",
                type: "select",
                required: true,
                options: [
                    {
                        name: "Choose type", 
                        value: null, 
                        disabled: true
                    },
                    {
                        name: "Email - General", 
                        value: 1
                    },
                    {
                        name: "Email - Study Session", 
                        value: 2
                    },
                    {
                        name: "Email - Assignment", 
                        value: 3
                    },
                    {
                        name: "Email - Study Close", 
                        value: 6
                    },
                    {
                        name: "Document - General", 
                        value: 4
                    },
                    {
                        name: "Document - Study", 
                        value: 5
                    }
                ],
            },
            {
                key: "defaultLanguage",
                label: "Default language",
                type: "select",
                required: true,
                options: [
                    { name: "English", value: "en" },
                    { name: "Deutsch", value: "de" },
                    { name: "Français", value: "fr" },
                ],
            },
        ];
        /**
         * Copy a public template for a different user.
         * Creates a new template row with sourceId linking to the original,
         * and copies all template_content rows.
         *
         * @param {number} sourceTemplateId - The ID of the source template to copy
         * @param {number} userId - The ID of the user creating the copy
         * @param {Object} [overrides={}] - Optional property overrides (e.g. name, force)
         * @param {Object} options - Database options including transaction
         * @returns {Promise<Object>} The copied template
         */
        static async copyTemplate(sourceTemplateId, userId, overrides = {}, options = {}) {
            const transaction = options.transaction;

            const source = await Template.findByPk(sourceTemplateId, { transaction });
            if (!source) {
                throw new Error(`Template with id ${sourceTemplateId} not found`);
            }
            if (!source.public) {
                throw new Error("Only public templates can be copied");
            }
            if (source.userId === userId) {
                throw new Error("Cannot copy your own template");
            }

            // Prevent duplicate copy (unless overrides.force is true)
            if (!overrides.force) {
                const existing = await Template.findOne({
                    where: { sourceId: sourceTemplateId, userId, deleted: false },
                    transaction,
                });
                if (existing) {
                    throw new Error("You have already copied this template");
                }
            }

            // Determine copy name
            const copyCount = await Template.count({
                where: { sourceId: sourceTemplateId, userId },
                transaction,
            });
            const copyName = overrides.name
                || (copyCount === 0 ? `${source.name} (copy)` : `${source.name} (copy ${copyCount + 1})`);

            // Create base template data
            const baseData = {
                name: copyName,
                description: source.description,
                type: source.type,
                defaultLanguage: source.defaultLanguage,
                userId: userId,
                public: false,
                sourceId: sourceTemplateId,
            };

            const copiedTemplate = await Template.add(
                Object.assign(baseData, overrides, { force: undefined }),
                { transaction }
            );

            // Copy all template_content rows
            await Template.copyLanguageContent(source.id, copiedTemplate.id, options);

            // Copy full edit history snapshot from source into the new copy
            await Template.copyEditHistory(source.id, copiedTemplate.id, options);

            // When force=true ("Make new copy"), bump updatedAt on existing copies of this source
            // so their status goes back to "Copy" (no longer "Update available")
            if (overrides.force) {
                const { Op } = require("sequelize");
                const existingCopies = await Template.findAll({
                    where: {
                        sourceId: sourceTemplateId,
                        userId: userId,
                        deleted: false,
                        id: { [Op.ne]: copiedTemplate.id },
                    },
                    transaction,
                });
                for (const copy of existingCopies) {
                    copy.changed('updatedAt', true);
                    await copy.save({ fields: ['updatedAt'], transaction });
                }
            }

            return copiedTemplate;
        }

        /**
         * Copy all language content rows from one template to another.
         *
         * @param {number} sourceTemplateId - Source template ID
         * @param {number} targetTemplateId - Target template ID
         * @param {Object} options - Database options including transaction
         * @returns {Promise<void>}
         */
        static async copyLanguageContent(sourceTemplateId, targetTemplateId, options = {}) {
            const rows = await sequelize.models.template_content.findAll({
                where: { templateId: sourceTemplateId, deleted: false },
                raw: true,
                transaction: options.transaction,
            });

            for (const row of rows) {
                await sequelize.models.template_content.add({
                    templateId: targetTemplateId,
                    language: row.language,
                    content: row.content,
                }, { transaction: options.transaction });
            }
        }

        /**
         * Copy all template_edit history rows from one template to another.
         *
         * Clones non-deleted template edit rows so that the target template has the same
         * edit history snapshot as the source at the time of copying.
         *
         * @param {number} sourceTemplateId - Source template ID
         * @param {number} targetTemplateId - Target template ID
         * @param {Object} options 
         * @returns {Promise<void>}
         */
        static async copyEditHistory(sourceTemplateId, targetTemplateId, options = {}) {
            const transaction = options.transaction;

            const rows = await sequelize.models.template_edit.findAll({
                where: { templateId: sourceTemplateId, deleted: false },
                raw: true,
                transaction,
            });

            if (!rows || rows.length === 0) {
                return;
            }

            const newRows = rows.map((row) => ({
                ...row,
                id: undefined,
                templateId: targetTemplateId,
            }));

            await sequelize.models.template_edit.bulkCreate(newRows, { transaction });
        }

        /**
         * Replace a copy's language content with the current content from its source.
         * Updates existing rows in place (or adds if missing) to respect UNIQUE(templateId, language).
         *
         * @param {number} copyId - The ID of the copied template
         * @param {Object} options - Database options including transaction
         * @returns {Promise<Object>} The updated copy
         */
        static async updateFromSource(copyId, options = {}) {
            const { Op } = require("sequelize");
            const transaction = options.transaction;
            const templateContentModel = sequelize.models.template_content;

            const copy = await Template.findByPk(copyId, { transaction });
            if (!copy || !copy.sourceId) {
                throw new Error("Template is not a copy or does not exist");
            }

            const source = await Template.findByPk(copy.sourceId, { transaction });
            if (!source || source.deleted) {
                throw new Error("Source template is no longer available");
            }

            // 1. Get all source language content
            const sourceRows = await templateContentModel.findAll({
                where: { templateId: source.id, deleted: false },
                raw: true,
                transaction,
            });

            // 2. Update or add each language for the copy (avoids UNIQUE(templateId, language) violation)
            for (const row of sourceRows) {
                const existing = await templateContentModel.findOne({
                    where: { templateId: copyId, language: row.language },
                    transaction,
                });
                if (existing) {
                    await templateContentModel.update(
                        { content: row.content, deleted: false, deletedAt: null },
                        { where: { id: existing.id }, transaction }
                    );
                } else {
                    await templateContentModel.add({
                        templateId: copyId,
                        language: row.language,
                        content: row.content,
                    }, { transaction });
                }
            }

            // 3. Mark copy rows for languages no longer in source as deleted
            const sourceLanguages = sourceRows.map((r) => r.language);
            if (sourceLanguages.length > 0) {
                await templateContentModel.update(
                    { deleted: true, deletedAt: new Date() },
                    {
                        where: {
                            templateId: copyId,
                            language: { [Op.notIn]: sourceLanguages },
                            deleted: false,
                        },
                        transaction,
                    }
                );
            }

            // 4. Delete all draft edits for the copy
            await sequelize.models.template_edit.update(
                { deleted: true, deletedAt: new Date() },
                { where: { templateId: copyId }, transaction }
            );

            await Template.copyEditHistory(source.id, copyId, options);

            // 5. Sync metadata and touch updatedAt — use instance-level save to ensure DB persistence and hook trigger
            const copyInstance = await Template.findByPk(copyId, { transaction });
            copyInstance.defaultLanguage = source.defaultLanguage;
            copyInstance.description = source.description;
            const copySuffixMatch = copyInstance.name.match(/\s*\(copy(?:\s+\d+)?\)$/);
            const copySuffix = copySuffixMatch ? copySuffixMatch[0] : ' (copy)';
            copyInstance.name = source.name + copySuffix;
            copyInstance.changed('updatedAt', true);
            await copyInstance.save({
                fields: ['defaultLanguage', 'description', 'name', 'updatedAt'],
                transaction,
            });

            return await Template.findByPk(copyId, { transaction });
        }

        /**
         * Detach a copy from its source by setting sourceId to null.
         * After detachment, the template behaves as a normal user-created template.
         *
         * @param {number} copyId - The ID of the copy to detach
         * @param {Object} options - Database options including transaction
         * @returns {Promise<Object>} The detached template
         */
        static async detach(copyId, options = {}) {
            const copy = await Template.findByPk(copyId, { transaction: options.transaction });
            if (!copy) {
                throw new Error("Template not found");
            }
            if (!copy.sourceId) {
                throw new Error("Template is not a copy");
            }
            await copy.update({ sourceId: null }, { transaction: options.transaction });
            return await Template.findByPk(copyId, { transaction: options.transaction });
        }

        static associate(models) {
            Template.hasMany(models["template_content"], {
                foreignKey: "templateId",
                as: "template_contents",
            });
            Template.belongsTo(models["user"], {
                foreignKey: "userId",
                as: "user",
            });
        }
    }
    Template.init(
        {
            name: DataTypes.STRING,
            description: DataTypes.TEXT,
            userId: DataTypes.INTEGER,
            public: DataTypes.BOOLEAN,
            type: DataTypes.INTEGER,
            sourceId: DataTypes.INTEGER,
            defaultLanguage: DataTypes.STRING,
            deleted: DataTypes.BOOLEAN,
            deletedAt: DataTypes.DATE,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        {
            sequelize,
            modelName: "template",
            tableName: "template",
            hooks: {
                beforeUpdate: async (template, options) => {
                    // Prevent unpublishing: if template was public, cannot be set to false
                    if (
                        template._previousDataValues &&
                        template._previousDataValues.public === true &&
                        template.public === false
                    ) {
                        throw new Error(
                            "Cannot make a template non-public once it has been made public"
                        );
                    }

                    // Email templates must have required placeholders in stable content before publish
                    if (
                        template.public === true &&
                        template._previousDataValues?.public !== true &&
                        [1, 2, 3, 6, 7].includes(template.type)
                    ) {
                        await assertStableEmailTemplateContent(template.id, sequelize.models, {
                            transaction: options.transaction,
                            action: "publishing",
                        });
                    }

                    // appDataUpdate / updateData passes callerUserId so hooks can enforce ownership
                    if (options.callerUserId === undefined) {
                        return;
                    }

                    if (template.userId !== options.context.currentUserId) {
                        throw new Error(
                            "You can only update templates that you own"
                        );
                    }

                    const prevSourceId = template._previousDataValues?.sourceId;
                    const nextSourceId = template.sourceId;
                    // Allow clearing sourceId (detach); block other edits while still a copy
                    if (
                        prevSourceId != null &&
                        nextSourceId != null
                    ) {
                        throw new Error("Copied templates cannot be edited");
                    }
                }
            }
        }
    );
    return Template;
}