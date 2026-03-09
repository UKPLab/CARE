'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Get all study steps grouped by studyId
    const [studySteps] = await queryInterface.sequelize.query(
      `SELECT id, "studyId", "studyStepPrevious" FROM study_step WHERE deleted = false ORDER BY "studyId"`
    );

    // Group steps by studyId
    const stepsByStudy = {};
    studySteps.forEach(step => {
      if (!stepsByStudy[step.studyId]) {
        stepsByStudy[step.studyId] = [];
      }
      stepsByStudy[step.studyId].push(step);
    });

    // Process each study's steps
    for (const studyId in stepsByStudy) {
      const steps = stepsByStudy[studyId];
      
      // Sort steps using the linked list approach
      const sorted = [];
      const stepMap = new Map();
      
      // Create a map for quick lookup
      steps.forEach(step => {
        stepMap.set(step.id, step);
      });
      
      // Find the first step (studyStepPrevious is null)
      const firstStep = steps.find(step => !step.studyStepPrevious);
      
      if (!firstStep) {
        continue; // Skip if no first step found
      }
      
      // Start with the first step and follow the chain
      let currentStep = firstStep;
      const processedIds = new Set();
      
      while (currentStep && !processedIds.has(currentStep.id)) {
        sorted.push(currentStep);
        processedIds.add(currentStep.id);
        
        // Find the next step (step that has current step as previous)
        currentStep = steps.find(step => 
          step.studyStepPrevious === currentStep.id && 
          !processedIds.has(step.id)
        );
      }
      
      // Add any remaining steps that weren't part of the main chain
      steps.forEach(step => {
        if (!processedIds.has(step.id)) {
          sorted.push(step);
        }
      });
      
      // Update each step with its stepNumber (starting from 1)
      for (let i = 0; i < sorted.length; i++) {
        await queryInterface.sequelize.query(
          `UPDATE study_step SET "stepNumber" = :stepNumber WHERE id = :id`,
          {
            replacements: {
              stepNumber: i + 1,
              id: sorted[i].id
            }
          }
        );
      }
    }
  },

  async down (queryInterface, Sequelize) {
    // Reset all stepNumbers to null
    await queryInterface.sequelize.query(
      `UPDATE study_step SET "stepNumber" = NULL`
    );
  }
};
