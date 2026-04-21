'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
	class AssignmentRole extends MetaModel {
		static autoTable = true;

		static associate(models) {
			AssignmentRole.belongsTo(models["assignment"], {
				foreignKey: "assignmentId",
				as: "assignment",
			});

			AssignmentRole.belongsTo(models["user_role"], {
				foreignKey: "roleId",
				as: "role",
			});

			AssignmentRole.belongsTo(models["user"], {
				foreignKey: "userId",
				as: "user",
			});
		}
	}

	AssignmentRole.init(
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
			modelName: 'assignment_role',
			tableName: 'assignment_role',
			hooks: {
				afterUpdate: async (assignmentRole, options) => {
					if (assignmentRole.deleted && !assignmentRole._previousDataValues.deleted) {
						await AssignmentRole.destroy({ where: { id: assignmentRole.id }, transaction: options.transaction });
					}
				},
			},
		}
	);

	return AssignmentRole;
};
