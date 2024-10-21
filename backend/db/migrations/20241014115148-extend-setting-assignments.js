'use strict';

const settings = [{
  key: "assignment_role_slider_max",
  value: 10,
  type: "integer",
  description: "The maximum number of assignments to peer review per role"
},
{
  key: "assignment_role_slider_student_default",
  value: 3,
  type: "integer",
  description: "The default number of assignments to peer review per student"
},
{
  key: "assignment_role_slider_tutor_default",
  value: 3,
  type: "integer",
  description: "The default number of assignments to peer review per tutor"
}]

module.exports = {
  async up(queryInterface, Sequelize) {
      const groups = await queryInterface.bulkInsert('setting', settings.map(t => {
          t['createdAt'] = new Date();
          t['updatedAt'] = new Date();
          return t;
      }), {returning: true});

  },

  async down(queryInterface, Sequelize) {
      //delete nav elements first
      await queryInterface.bulkDelete("setting", {
          key: settings.map(t => t.key)
      }, {});
  }
};
