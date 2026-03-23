'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
	class Assignment extends MetaModel {
		static autoTable = true;
		static fields = [
			{
				key: "title",
				label: "Assignment Title:",
				placeholder: "Assignment 1",
				type: "text",
				required: true,
				default: "",
			},
			{
				key: "description",
				label: "Description:",
				help: "Optional description shown for this assignment.",
				type: "textarea",
				required: false,
			},
			{
				key: "studyId",
				label: "Study:",
				type: "select",
				options: {
					table: "study",
					name: "name",
					value: "id",
				},
				required: false,
				help: "Select a study assignment source.",
			},
			{
				key: "workflowId",
				label: "Workflow:",
				type: "select",
				options: {
					table: "workflow",
					name: "name",
					value: "id",
				},
				required: false,
				help: "Select a workflow assignment source.",
			},
			{
				key: "maxRevisions",
				label: "Maximum Revisions:",
				placeholder: "1",
				type: "number",
				min: 1,
				required: true,
				default: 1,
				help: "Maximum number of allowed revision copies for this assignment.",
			},
			{
				key: "start",
				label: "Start Time:",
				type: "datetime",
				size: 6,
				default: null,
				required: false,
			},
			{
				key: "end",
				label: "End Time:",
				type: "datetime",
				size: 6,
				default: null,
				required: false,
			},
			{
				key: "validationConfigurationId",
				label: "Validation Configuration:",
				type: "select",
				options: {
					table: "configuration",
					name: "name",
					value: "id",
					filter: [
						{ key: "type", value: 1 },
					],
				},
				required: true,
				help: "Validation is applied before submission upload.",
			},
			{
				key: "allowReUpload",
				label: "Allow Re-Upload:",
				type: "switch",
				default: false,
				required: false,
				help: "If enabled, users can replace or delete uploaded submissions.",
			},
		];
		static associate(models) {
			Assignment.belongsTo(models["study"], {
				foreignKey: "studyId",
				as: "study",
			});

			Assignment.belongsTo(models["workflow"], {
				foreignKey: "workflowId",
				as: "workflow",
			});

			Assignment.belongsTo(models["configuration"], {
				foreignKey: "validationConfigurationId",
				as: "validationConfiguration",
			});

			Assignment.belongsTo(models["assignment"], {
				foreignKey: "parentAssignmentId",
				as: "parentAssignment",
			});

			Assignment.belongsTo(models["assignment"], {
				foreignKey: "previousSubmissionAssignmentId",
				as: "previousSubmissionAssignment",
			});
		}
	}

	Assignment.init(
		{
			title: DataTypes.STRING,
			description: DataTypes.TEXT,
			studyId: DataTypes.INTEGER,
			workflowId: DataTypes.INTEGER,
			maxRevisions: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 1,
			},
			start: DataTypes.DATE,
			end: DataTypes.DATE,
			validationConfigurationId: DataTypes.INTEGER,
			parentAssignmentId: DataTypes.INTEGER,
			previousSubmissionAssignmentId: DataTypes.INTEGER,
			allowReUpload: DataTypes.BOOLEAN,
			deleted: DataTypes.BOOLEAN,
			deletedAt: DataTypes.DATE,
			createdAt: DataTypes.DATE,
			updatedAt: DataTypes.DATE,
		},
		{
			sequelize,
			modelName: 'assignment',
			tableName: 'assignment',
		}
	);

	return Assignment;
};
