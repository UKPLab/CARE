const fs = require("fs");
const path = require("path");

const UPLOAD_PATH = `${__dirname}/../../../files`;

const Socket = require("../Socket.js");
const { docTypes } = require("../../db/models/document.js");

/**
 * Handle all uploads through websocket
 *
 * Uploading a file through websocket
 *
 * @author Dennis Zyska
 * @type {UploadSocket}
 */
module.exports = class UploadSocket extends Socket {
  /**
   * Uploads the given data object as a document. Stores the given pdf file in the files path and creates
   * an entry in the database.
   * @author Zheyu Zhang, Linyin Huang
   * @param {Object} data - The data object containing the document details.
   * @param {string} data.name - The name of the document.
   * @param {Buffer} data.file - The binary content of the document.
   * @param {string} [data.userId] - The ID of the user who owns the document (optional).
   * @param {boolean} [data.isUploaded] - Indicates if the document is uploaded by an admin (optional).
   * @returns {Promise<void>}
   */
  async uploadDocument(data) {
    try {
      let doc = null;
      let target = "";
      if (data.type === "document") {
        doc = await this.models["document"].add({
          name: data.name.replace(/.pdf$/, ""),
          type: docTypes.DOC_TYPE_PDF,
          // If data includes userId, it means the document is uploaded by an admin
          userId: data.userId ?? this.userId,
          uploaded: data.isUploaded ?? false,
          readyForReview: data.isUploaded ?? false,
        });

        target = path.join(UPLOAD_PATH, `${doc.hash}.pdf`);
      } else if (data.type === "deltaDocument") {
        doc = await this.models["document"].add({
          name: data.name.replace(/.delta$/, ""),
          // If data includes userId, it means the document is uploaded by an admin
          userId: data.userId ?? this.userId,
          type: docTypes.DOC_TYPE_HTML,
        });

        target = path.join(UPLOAD_PATH, `${doc.hash}.delta`);
      }

      fs.writeFile(target, data.file, (err) => {
        if (err) {
          this.socket.emit("uploadResult", { success: false, error: err.message });
        } else {
          this.socket.emit("uploadResult", { success: true, documentId: doc.id });
        }
      });

      this.emit("documentRefresh", doc);
    } catch (error) {
      this.logger.error("Error uploading document:", error);
      this.socket.emit("uploadResult", { success: false, error: error.message });
    }
  }

  /**
   * @borrows MoodleRPC.downloadSubmissionsFromUser as downloadSubmissionsFromUser
   */
  async downloadSubmissionsFromUser(data) {
    try {
      return await this.server.rpcs["MoodleRPC"].downloadSubmissionsFromUser(data);
    } catch (error) {
      this.logger.error(error);
    }
  }

  /**
   * Download Moodle Submission and then upload them to CARE server
   * @param {*} data
   * @param {*} data.options - Contains Moodle info such as apiKey and url
   * @param {*} data.files - Contains files to be downloaded from Moodle
   * @returns
   */
  async bulkUploadSubmissionToServer(data) {
    const { options, files } = data;
    const results = [];

    for (const file of files) {
      try {
        // Download the submission
        const response = await this.downloadSubmissionsFromUser({
          fileUrls: [file.fileUrl],
          options,
        });

        if (!response.success) {
          throw new Error(`Failed to download submission from Moodle for user with ${file.userId}`);
        }

        const uploadData = {
          type: "document",
          file: response.data[0],
          name: file.fileName,
          userId: file.userId,
          isUploaded: true,
        };

        // Upload the document and create a database entry
        await this.uploadDocument(uploadData);

        results.push({
          userId: file.userId,
          fileName: file.fileName,
          success: true,
        });
      } catch (error) {
        this.logger.error(`Failed to download submission from Moodle for user with ${file.userId}`);
        results.push({
          userId: file.userId,
          fileName: file.fileName,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  init() {
    //Make sure upload directory exists
    fs.mkdirSync(UPLOAD_PATH, { recursive: true });

    this.socket.on("uploadFile", async (data) => {
      try {
        if (data.type === "document" || data.type === "deltaDocument") {
          await this.uploadDocument(data);
        }
      } catch (err) {
        this.logger.error("Upload error: " + err);
        this.socket.emit("uploadResult", { success: false });
      }
    });

    this.socket.on("uploadMoodleSubmission", async (data, callback) => {
      try {
        const results = await this.bulkUploadSubmissionToServer(data);
        callback({ success: true, results });
      } catch (error) {
        this.logger.error("Error in method bulkUploadSubmissionToServer:", error);
        callback({ success: false, error: "Failed to bulk download students' submissions" });
      }
    });
  }
};
