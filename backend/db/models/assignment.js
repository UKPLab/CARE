'use strict';
const MetaModel = require("../MetaModel.js");
const { Op } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
	class Assignment extends MetaModel {
		static autoTable = true;

		/**
		 * Apply visibility filter for assignments based on assigned roles.
		 * Non-admin users can always see their own assignments and assignments
		 * that are assigned to at least one of their roles.
		 */
		static async getUserFilter(userId) {
			const roleIds = await sequelize.models.user_role_matching.getUserRolesById(userId);
			const isAdmin = await sequelize.models.user_role_matching.isAdminInUserRoles(roleIds);
			if (isAdmin) {
				return {};
			}

			if (!Array.isArray(roleIds) || roleIds.length === 0) {
				return { userId };
			}

			return {
				[Op.or]: [
					{ userId },
					{ assignedRoleIds: { [Op.overlap]: roleIds } },
				],
			};
		}
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
				type: "slider",
				class: "custom-slider-class",
				min: 1,
				max: 20,
				step: 1,
				unit: "revision(s)",
				unlimitedAtMax: true,
				unlimitedLabel: "unlimited",
				unlimitedStoredValue: 0,
				required: true,
				default: 1,
				help: "Maximum number of allowed revision copies for this assignment. Move to the end for unlimited.",
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
			userId: DataTypes.INTEGER,
			public: DataTypes.BOOLEAN,
			maxRevisions: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 1,
			},
			start: DataTypes.DATE,
			end: DataTypes.DATE,
			validationConfigurationId: DataTypes.INTEGER,
			assignedRoleIds: {
				type: DataTypes.ARRAY(DataTypes.INTEGER),
				allowNull: true,
				defaultValue: [],
			},
			parentAssignmentId: DataTypes.INTEGER,
			allowReUpload: DataTypes.BOOLEAN,
			closed: DataTypes.DATE,
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
