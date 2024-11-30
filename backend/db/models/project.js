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
                key: "userId",
                label: "User ID of the document",
                placeholder: "#",
                type: "text",
                required: false,
                default: "",
            },
            {
                key: "public",
                label: "Is the document published?",
                type: "switch",
                required: false,
                default: false
            },
            {
                key: "closed",
                label: "Is the project closed?",
                type: "date",
                required: false,
                default: null
            },
            {
                key: "deleted",
                label: "Is the project deleted?",
                type: "switch",
                required: false,
                default: false
            },
            {
                key: "description",
                label: "Description of the project:",
                placeholder: "My project description",
                type: "textarea",
                required: false,
                default: "",
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
        deleted: DataTypes.BOOLEAN
    }, {
        sequelize: sequelize,
        modelName: 'project',
        tableName: 'project',
        hooks: {

        }
    });
    return Project;
};
