const Socket = require("../Socket.js");
const { v4: uuidv4 } = require("uuid");
const { genSalt, genPwdHash } = require("../../utils/auth.js");
const { generateMarvelUsername } = require("../../utils/generator.js");

/**
 * Handle user through websocket
 *
 * @author Alexander Bürkle
 * @type {AssignmentSocket}
 */
module.exports = class AssignmentSocket extends Socket {
  async getReviewableAssignments() {
    try {
      const [documentUserIds, matchedUsers, users, roleIdMap] = await Promise.all([
        this.models["document"].findAll({
          where: { readyForReview: true },
          attributes: ["userId", "name"],
          raw: true,
        }),
        this.models["user_role_matching"].findAll({
          attributes: ["userId", "userRoleId"],
          raw: true,
        }),
        this.models["user"].findAll({
          attributes: { exclude: ["passwordHash", "salt"] },
          raw: true,
        }),
        this.models["user_role"].findAll({
          attributes: ["id", "name"],
          raw: true,
        })
      ]);
  
      const idToNameMap = new Map(roleIdMap.map(({ id, name }) => [id, name]));
      const matchedUserMap = new Map(matchedUsers.map(({ userId, userRoleId }) => [userId, userRoleId]));
  
      const userInfos = users.map(user => {
        const documents = documentUserIds.filter(doc => doc.userId === user.id);
        const roleName = idToNameMap.get(matchedUserMap.get(user.id)) || null;
  
        return {
          ...user,
          documents,
          numberAssignments: documents.length,
          role: roleName,
        };
      });
  
      this.socket.emit("assignmentUserInfos", {
        success: true,
        userInfos,
      });
    } catch (error) {
      this.logger.error(error);
    }
  }


  async assignPeerReviews(assignments, reviewers, reviewsPerRole) {
    // Helper function to shuffle an array
    const shuffleArray = (array) => array.sort(() => Math.random() - 0.5);
  
    // Track the assignments that reviewers have been assigned
    const assignmentTracker = new Map();
  
    // Initialize the assignment tracker for each assignment, using a combination of userId and documentName
    assignments.forEach((assignment) => {
      const uniqueAssignmentKey = `${assignment.userId}_${assignment.documentName}`;
      assignmentTracker.set(uniqueAssignmentKey, new Map(Object.keys(reviewsPerRole).map(role => [role, []])));
    });
  
    // Create a map of reviewers by their role
    const reviewersByRole = reviewers.reduce((acc, reviewer) => {
      const role = reviewer.role;
      if (!acc[role]) acc[role] = [];
      acc[role].push(reviewer);
      return acc;
    }, {});
  
    // Assign reviewers to assignments based on reviewsPerRole
    assignments.forEach((assignment) => {
      const uniqueAssignmentKey = `${assignment.userId}_${assignment.documentName}`;
      for (const [role, numReviewersStr] of Object.entries(reviewsPerRole)) {
        const numReviewersNeeded = parseInt(numReviewersStr, 10); // Convert string to number
  
        // Skip roles that have 0 reviewers specified in reviewsPerRole
        if (numReviewersNeeded === 0) continue;
  
        // If the role isn't present in reviewersByRole, continue to the next role
        const availableReviewers = reviewersByRole[role] || [];
  
        // Shuffle reviewers to randomize the assignments
        const shuffledReviewers = shuffleArray(availableReviewers);
  
        // Track the assigned reviewers for the current role
        let assignedReviewersCount = assignmentTracker.get(uniqueAssignmentKey).get(role).length;
  
        for (const reviewer of shuffledReviewers) {
          // Ensure that a reviewer is not assigned to review their own assignment
          if (assignment.userId !== reviewer.id && !assignmentTracker.get(uniqueAssignmentKey).get(role).includes(reviewer.id)) {
            // Add the reviewer to the assignment under the correct role if not exceeding the limit
            if (assignedReviewersCount < numReviewersNeeded) {
              assignmentTracker.get(uniqueAssignmentKey).get(role).push(reviewer.id);
              assignedReviewersCount++;
            }
          }
  
          // Stop assigning if we have enough reviewers for this role
          if (assignedReviewersCount >= numReviewersNeeded) break;
        }
      }
    });
  
    // Return assignments with their assigned reviewers grouped by role
    const result = assignments.map((assignment) => {
      const uniqueAssignmentKey = `${assignment.userId}_${assignment.documentName}`;
      const assignedReviewers = {};
      
      // Flatten the role-reviewer map for easier use
      for (const [role, reviewers] of assignmentTracker.get(uniqueAssignmentKey)) {
        assignedReviewers[role] = reviewers;
      }
  
      return {
        ...assignment,
        assignedReviewers,
      };
    });

    result.forEach(async (assignment) => {
      this.models["study"].add({
        userId: assignment.userId,
        documentId: assignment.documentId,
        assignedReviewers: JSON.stringify(assignment.assignedReviewers),
      });

  
      // Update the document with the assigned reviewers
      await this.models["document"].update(
        {
          assignedReviewers: JSON.stringify(assignment.assignedReviewers),
        },
        {
          where: { id: document.id },
        }
      );
    })
  }
  
  
  


  init() {

    this.socket.on("assignmentGetReviewableDocs", async (callback) => {
      try {
        await this.getReviewableAssignments();
        const users = {}
        //console.log(users)
        callback({
          success: true,
          users: users,
        });
      } catch (error) {
        const errorMsg = "User rights and request parameter mismatch";
        this.logger.error(errorMsg);
      }
    });

    this.socket.on("assignPeerReviews", async (data, callback) => {
      try {
        console.log(data)
        const assignments = await this.assignPeerReviews(data.assignments, data.reviewers, data.reviewsPerRole);
        callback({
          success: true,
          assignments: assignments,
        });
        this.socket.emit("peerReview", {
          success: true,
          users,
        });
      } catch (error) {
        const errorMsg = "User rights and request parameter mismatch";
        this.socket.emit("userByRole", {
          success: false,
          message: errorMsg,
        });
        this.logger.error(errorMsg + error);
      }
    });

  }
};
