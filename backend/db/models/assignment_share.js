'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
	class AssignmentShare extends MetaModel {
		static autoTable = true;
		static accessMap = [
			{
				right: "frontend.dashboard.assignments.viewAll",
				columns: this.getAttributes(),
			},
		];

		static associate(models) {
			AssignmentShare.belongsTo(models["assignment"], {
				foreignKey: "assignmentId",
				as: "assignment",
			});

			AssignmentShare.belongsTo(models["user_role"], {
				foreignKey: "roleId",
				as: "role",
			});

			AssignmentShare.belongsTo(models["user"], {
				foreignKey: "userId",
				as: "user",
			});
		}
	}

	AssignmentShare.init(
		{
			assignmentId: DataTypes.INTEGER,
			roleId: DataTypes.INTEGER,
			userId: DataTypes.INTEGER,
			deleted: DataTypes.BOOLEAN,
			createdAt: DataTypes.DATE,
			updatedAt: DataTypes.DATE,
		},
		{
			sequelize,
			modelName: 'assignment_share',
			tableName: 'assignment_share',
			hooks: {
				afterUpdate: async (assignmentShare, options) => {
					if (assignmentShare.deleted && !assignmentShare._previousDataValues.deleted) {
						await AssignmentShare.destroy({ where: { id: assignmentShare.id }, transaction: options.transaction });
					}
				},
			},
		}
	);

	return AssignmentShare;
};
