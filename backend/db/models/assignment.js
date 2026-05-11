'use strict';
const MetaModel = require("../MetaModel.js");
const { Op } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
	class Assignment extends MetaModel {
		static autoTable = true;
		static accessMap = [
			{
				right: "frontend.dashboard.assignments.viewAll",
				columns: this.getAttributes(),
			},
		];
		static fields = [
			{
				key: "name",
				label: "Assignment Name:",
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
			{
				key: "notifyOnSubmissionUpload",
				label: "Notify on Submission Upload:",
				type: "switch",
				default: false,
				required: false,
				help: "If enabled, sends an email when a student uploads or re-uploads a submission.",
			},
		];

		/**
		 * Apply visibility filter for assignments based on assignment_share.
		 * A user can see an assignment if they are the owner (userId), or if the
		 * assignment's assignment_share entry has their userId or one of their roleIds.
		 *
		 * @param {number} userId - The ID of the user to build the filter for.
		 * @returns {object} Sequelize where-clause filter object.
		 */
		static async getUserFilter(userId) {
			const roleIds = await sequelize.models.user_role_matching.getUserRolesById(userId);

			// Step 1: build the assignment_share query — rows belonging to this user directly or via role
			const roleOrConditions = [{ userId }];
			if (Array.isArray(roleIds) && roleIds.length > 0) {
				roleOrConditions.push({ roleId: { [Op.in]: roleIds } });
			}
			// Step 2: find all assignmentIds this user is linked to
			const matchingEntries = await sequelize.models.assignment_share.findAll({
				attributes: ['assignmentId'],
				where: {
					deleted: { [Op.not]: true },
					[Op.or]: roleOrConditions,
				},
				raw: true,
			});
			const assignedIds = [...new Set(matchingEntries.map(e => e.assignmentId))];

			// Step 3: filter assignments by ownership or assignment_share membership
			const filter = { [Op.or]: [{ userId }] };
			if (assignedIds.length > 0) {
				filter[Op.or].push({ id: { [Op.in]: assignedIds } });
			}
			return filter;
		}
		static associate(models) {

			Assignment.belongsTo(models["configuration"], {
				foreignKey: "validationConfigurationId",
				as: "validationConfiguration",
			});

			Assignment.belongsTo(models["assignment"], {
				foreignKey: "parentAssignmentId",
				as: "parentAssignment",
			});
		}
	}

	Assignment.init(
		{
			name: DataTypes.STRING,
			description: DataTypes.TEXT,
			projectId: DataTypes.INTEGER,
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
			parentAssignmentId: DataTypes.INTEGER,
			allowReUpload: DataTypes.BOOLEAN,
			notifyOnSubmissionUpload: DataTypes.BOOLEAN,
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
