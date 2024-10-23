const Socket = require("../Socket.js");
const { v4: uuidv4 } = require("uuid");
const { genSalt, genPwdHash } = require("../../utils/auth.js");
const { generateMarvelUsername } = require("../../utils/generator.js");

/**
 * Handle user through websocket
 *
 * @author Alexander Bürkle, Dennis Zyska, Nils Dycke
 * @type {AssignmentSocket}
 */
module.exports = class AssignmentSocket extends Socket {
  async getReviewableAssignments() {
    try {
      return await this.models["user"].getReviewableAssignments()
    } catch (error) {
      this.logger.error(error);
    }
  }


  async assignPeerReviews(assignments, students, tutors, studentReviewsPerPerson, tutorReviewsPerPerson) {
    const assignmentCount = assignments.length;
  
    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
  
    const shuffledStudents = shuffleArray([...students]);
    const shuffledTutors = shuffleArray([...tutors]);
  
    const peerReviewAssignments = {
      students: {},
      tutors: {}
    };
  
    shuffledStudents.forEach(student => {
      const shuffledAssignments = shuffleArray([...assignments]);
      peerReviewAssignments.students[student] = shuffledAssignments.slice(0, studentReviewsPerPerson);
    });
  
    
    shuffledTutors.forEach(tutor => {     
      const shuffledAssignments = shuffleArray([...assignments]);  
      peerReviewAssignments.tutors[tutor] = shuffledAssignments.slice(0, tutorReviewsPerPerson);
    });
  
    assignments.forEach(assignment => {
      const assignedTutors = Object.keys(peerReviewAssignments.tutors).filter(tutor => 
        peerReviewAssignments.tutors[tutor].includes(assignment)
      );
  
      // If no tutor is assigned to this assignment, assign one randomly
      if (assignedTutors.length === 0) {
        const randomTutor = shuffledTutors[Math.floor(Math.random() * shuffledTutors.length)];
        peerReviewAssignments.tutors[randomTutor].push(assignment);
      }
    });
  
    console.log(peerReviewAssignments)
    return peerReviewAssignments;
  }


  init() {

    this.socket.on("getReviewableAssignments", async (callback) => {
      try {
        const users = await this.getReviewableAssignments();
        console.log(users)
        callback({
          success: true,
          users: users,
        });
        this.socket.emit("reviewAssignments", {
          success: true,
          users,
        });
      } catch (error) {
        this.logger.error(errorMsg);
      }
    });

    this.socket.on("assignPeerReviews", async (data, callback) => {
      try {
        console.log(data)
        const assignments = await this.assignPeerReviews(data.assignments, data.students, data.tutors, data.reviewsPerStudent, data.reviewsPerTutor);
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
