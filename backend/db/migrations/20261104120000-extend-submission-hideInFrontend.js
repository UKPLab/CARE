'use strict';

/**
 * Persist the hidden flag of submission copies. Copies made by a study-session assignment set it from
 * now on; every existing row stays visible.
 *
 * There is deliberately no backfill. The flag was never stored before, and nothing else records why a
 * copy was made: group copies and session copies are written with the same columns, and study edits,
 * template replacement and unmapped template steps all give a group copy the same parentStudyId and
 * document ancestry as a session copy. Hiding by that ancestry would take valid group submissions out
 * of the assignment picker, so this migration does not try.
 *
 * Existing session copies therefore remain visible and assignable until someone reviews and cleans them
 * up by hand. This migration does not resolve them.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('submission', 'hideInFrontend', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('submission', 'hideInFrontend');
  },
};
