const fs = require("fs");
const path = require("path");

const UPLOAD_PATH = `${__dirname}/../../../files`;

const Socket = require("../Socket.js");
const docTypes = require("../../db/models/document.js").docTypes;

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
   *
   * @author Zheyu Zhang
   * @param data the data including name and pdf binary file
   * @returns {Promise<void>}
   */
  async uploadDocument(data) {
    try {

      if(data.type === "document") {
          const doc = await this.models["document"].add({
            name: data.name.replace(/.pdf$/, ""),
            userId: this.userId,
            type: docTypes.DOC_TYPE_PDF
          });
      
          const target = path.join(UPLOAD_PATH, `${doc.hash}.pdf`);

      } else if(data.type === "deltaDocument") {
          const doc = await this.models["document"].add({
            name: data.name.replace(/.delta$/, ""),
            userId: this.userId,
            type: docTypes.DOC_TYPE_HTML
          });

          const target = path.join(UPLOAD_PATH, `${doc.hash}.delta`);
          
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
      console.error("Error uploading document:", error);
      this.socket.emit("uploadResult", { success: false, error: error.message });
    }
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
  }
};