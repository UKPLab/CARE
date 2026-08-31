'use strict';

/**
 * Composite index for Studies dashboard queryTable default shape:
 * WHERE projectId + deleted + template ORDER BY createdAt, id (cursor keyset).
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('study', ['projectId', 'deleted', 'template', 'createdAt', 'id'], {
      name: 'study_project_list_created',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('study', 'study_project_list_created');
  },
};
