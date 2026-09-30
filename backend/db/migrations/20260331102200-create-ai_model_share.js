'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ai_model_share', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      aiModelId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ai_model',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
          model: 'user',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      roleId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
          model: 'user_role',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      expiryDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Per-request share lookup is model + user or role. Visibility loads by userId or roleId.
    await queryInterface.addIndex('ai_model_share', ['aiModelId', 'userId'], {
      name: 'ai_model_share_aiModelId_userId_index',
    });
    await queryInterface.addIndex('ai_model_share', ['aiModelId', 'roleId'], {
      name: 'ai_model_share_aiModelId_roleId_index',
    });
    await queryInterface.addIndex('ai_model_share', ['userId'], {
      name: 'ai_model_share_userId_index',
    });
    await queryInterface.addIndex('ai_model_share', ['roleId'], {
      name: 'ai_model_share_roleId_index',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ai_model_share');
  },
};
