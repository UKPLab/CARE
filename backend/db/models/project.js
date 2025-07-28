'use strict';
const MetaModel = require("../MetaModel.js");


module.exports = (sequelize, DataTypes) => {
    class Project extends MetaModel {

        static autoTable = true;

        static fields = [
            {
                key: "name",
                label: "Name of the project:",
                placeholder: "My project",
                type: "text",
                required: true,
                default: "",
            },
            {
                key: "description",
                label: "Description of the project:",
                placeholder: "My project description",
                type: "textarea",
                required: false,
                default: "",
            },
            {
                key: "public",
                label: "Is the project public?",
                type: "switch",
                required: false,
                default: false
            },

                
        ]

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            
        }

        
    }

    Project.init({
        name: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        description: DataTypes.TEXT,
        public: DataTypes.BOOLEAN,
        closed: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
    }, {
        sequelize: sequelize,
        modelName: 'project',
        tableName: 'project',
        hooks: {
            afterUpdate: async (project, options) => {
                // If the project is deleted, we need to delete all the documents associated with it
                if (project.deleted) {
                    // delete associated documents
                    const documents = await sequelize.models.document.getAllByKey("projectId", project.id);
                    for (const document of documents) {
                        await sequelize.models.document.deleteById(document.id, {transaction: options.transaction});
                    }
                    // Delete all the studies associated with the documents
                    const studies = await sequelize.models.study.getAllByKey("projectId", project.id);
                    for (const study of studies) {
                        await sequelize.models.study.deleteById(study.id, {transaction: options.transaction});
                    }
                    // Delete all the tag sets associated with the project
                    const tagSets = await sequelize.models.tag_set.getAllByKey("projectId", project.id);
                    for (const tagSet of tagSets) {
                        await sequelize.models.tag_set.deleteById(tagSet.id, {transaction: options.transaction});
                    }

                }
            }
        }
    });
    return Project;
};
