'use strict';

const projects = [
  {
    name: "EiWA Project",
    description: "EiWA Project: Review a PDF document and write free text.",
    userId: null
  }
];

module.exports = {
  async up (queryInterface, Sequelize) {
    const projectInsertions = await queryInterface.bulkInsert(
      'project',
      projects.map(p => ({
          name: p.name,
          description: p.description
      })),
      { returning: true }
  );

  const projectMap = {};
  projectInsertions.forEach((p, index) => {
    projectMap[projects[index].name] = p.id;
  });

  },

  async down (queryInterface, Sequelize) {
    const projectNames = projects.map(p => p.name);

    await queryInterface.bulkDelete('project', {
          name: projectNames
      }, {});
  }
};
