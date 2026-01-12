'use strict';
const MetaModel = require("../MetaModel.js");

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
                // Admins: own templates (all types) OR published templates from others
                return {[Op.or]: [{userId: userId}, {published: true}]};
            } else {
                // Non-admins: own templates (excluding Type 1) OR published templates from others (excluding Type 1)
                return {
                    [Op.or]: [
                        {[Op.and]: [{userId: userId}, {type: {[Op.ne]: 1}}]},
                        {[Op.and]: [{published: true}, {type: {[Op.ne]: 1}}]}
                    ]
                };
            }
        }

        /**
         * Override getAutoTable to apply custom filtering for templates:
         * - All users (including admins): own templates OR published templates from others
         * - Non-admins: exclude Type 1 (Email - General) templates
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
                        name: "Document - General", 
                        value: 4
                    },
                    {
                        name: "Document - Study", 
                        value: 5
                    }
                ],
            },
        ];
        static associate(models) {
            // No direct association needed
        }
    }
    Template.init(
        {
            name: DataTypes.STRING,
            description: DataTypes.TEXT,
            userId: DataTypes.INTEGER,
            published: DataTypes.BOOLEAN,
            type: DataTypes.INTEGER,
            content: DataTypes.JSONB,
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
                    // Prevent unpublishing: if template was published, cannot be set to false
                    if (
                        template._previousDataValues &&
                        template._previousDataValues.published === true &&
                        template.published === false
                    ) {
                        throw new Error(
                            "Cannot unpublish a template once it has been published"
                        );
                    }
                }
            }
        }
    );
    return Template;
}