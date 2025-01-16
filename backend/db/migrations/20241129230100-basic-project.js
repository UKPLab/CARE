'use strict';

const projects = [
  {
    name: "Default Project",
    description: "The default project",
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
