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
			assignmentId: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			roleId: {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
			userId: {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
			deleted: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},
			createdAt: DataTypes.DATE,
			updatedAt: DataTypes.DATE,
		},
		{
			sequelize,
			modelName: 'assignment_role',
			tableName: 'assignment_role',
		}
	);

	return AssignmentRole;
};
