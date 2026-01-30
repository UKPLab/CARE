'use strict';

/**
 * Migrate template content into template_language_content and drop template.content.
 * 
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Copy each template's content into template_language_content for its default language
      await queryInterface.sequelize.query(
        `INSERT INTO template_language_content ("templateId", "language", "content", "deleted", "createdAt", "updatedAt")
         SELECT id, COALESCE("defaultLanguage", 'en'), content, false, NOW(), NOW()
         FROM template`,
        { transaction }
      );

      await queryInterface.removeColumn('template', 'content', { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        'template',
        'content',
        {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        { transaction }
      );

      // Restore content from template_language_content (default language per template);
      // use minimal content for templates with no matching row
      await queryInterface.sequelize.query(
        `UPDATE template t
         SET content = COALESCE(
           (SELECT tlc.content FROM template_language_content tlc
            WHERE tlc."templateId" = t.id
              AND tlc."language" = COALESCE(t."defaultLanguage", 'en')
              AND tlc.deleted = false
            LIMIT 1),
           '{"ops":[{"insert":"\\n"}]}'::jsonb
         )`,
        { transaction }
      );

      await queryInterface.changeColumn(
        'template',
        'content',
        {
          type: Sequelize.JSONB,
          allowNull: false,
        },
        { transaction }
      );
    });
  },
};
