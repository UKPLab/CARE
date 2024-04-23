const Socket = require("../Socket.js");
const fs = require("fs");
const path = require("path");
const Delta = require("quill-delta");
const { Op } = require("sequelize");

const DOCUMENT_PATH = `${__dirname}/../../../files`;

/**
 * Handle all editable document through websocket
 *
 * Loading the editable document through websocket
 *
 * @author Zheyu Zhang
 */
module.exports = class EditableDocumentSocket extends Socket {
  /**
   * Update editable document
   * @param {number} editableDocumentId
   * @param {object} data editable document object
   * @returns {Promise<*>}
   */
  async updateEditableDocument(editableDocumentId, data) {
    const currentEditableDocument = await this.models["editable_document"].getById(editableDocumentId);
    if (this.checkUserAccess(currentEditableDocument.userId)) {
      const editable_doc = await this.models["editable_document"].updateById(editableDocumentId, data);

      if (editable_doc.deleted) {
        const sessions = await this.models["editable_document_session"].getAllByKey("editableDocumentId", editable_doc.id);
        for (const session of sessions) {
          await this.models["editable_document_session"].deleteById(session.id);
        }
      }

      this.emitEditableDocRefresh(editable_doc);
      return editable_doc;
    } else {
      this.sendToast("You are not allowed to update this editable document", "Error", "Danger");
    }
  }

  /**
   * emit editable doc refresh
   * @param {*} editableDoc
   */
  async emitEditableDocRefresh(editableDoc) {
    try {
      editableDoc.text = this.getDocDataFromLocalFile(editableDoc.docHash);

      this.emit("editable_docRefresh", editableDoc);
    } catch (error) {
      this.logger.error(error);
    }
  }

  /**
   * Add a new editable document
   * @param editable_document
   * @returns {Promise<void>}
   */
  async addEditableDoc(editable_document) {
    editable_document.userId = this.userId;

    const newEditableDoc = await this.models["editable_document"].add(editable_document);
    this.emitEditableDocRefresh(newEditableDoc);

    return newEditableDoc;
  }

  /**
   * Update editable document without notification via socket
   * @param {number} editableDocumentId
   * @param {object} data editable document object
   * @returns {Promise<*>}
   */
  async silentUpdateEditableDoc(editableDocumentId, data) {
    const currentEditableDoc = await this.models["editable_document"].getById(editableDocumentId);
    if (this.checkUserAccess(currentEditableDoc.userId)) {
      const editable_doc = await this.models["editable_document"].updateById(editableDocumentId, data);

      if (editable_doc.deleted) {
        const sessions = await this.models["editable_document_session"].getAllByKey("editableDocumentId", editable_doc.id);
        for (const session of sessions) {
          await this.models["editable_document_session"].deleteById(session.id);
        }
      }
    }
    return currentEditableDoc;
  }

  /**
   * Add a new editable document without notification via socket
   * @param editable_document
   * @returns {Promise<void>}
   */
  async silentAddEditableDoc(editable_document) {
    editable_document.userId = this.userId;

    const newEditableDoc = await this.models["editable_document"].add(editable_document);

    return newEditableDoc;
  }

  /**
   * Send a editable document by id
   * @param {number} editableDocumentId
   * @returns {Promise<void>}
   */
  async sendEditableDoc(editableDocumentId) {
    const editable_doc = await this.models["editable_document"].getById(editableDocumentId);
    if (editable_doc) {
      this.emitEditableDocRefresh(editable_doc);
    } else {
      this.socket.emit("editable_docError", {
        message: "Not found!"
      });
    }
  }

  /**
   * Get editable document by documentId if exists, else create a new editable document.
   * @param {object} data editable document object
   * @returns {Promise<void>}
   */
  async getOrCreateForDocument(data) {
    const editable_doc = await this.models["editable_document"].getByKey("documentId", data.documentId);

    if (editable_doc) {
      await this.syncDocDataFromDiffData({ editableDocId: data.documentId });
      this.emitEditableDocRefresh(editable_doc);
    } else {
      await this.addEditableDoc(data);
    }
  }

  /**
   * Save docuemnt history data
   * @param docuemnt
   * @param diff
   * @returns {Promise<void>}
   */
  async saveHistoryData(docuemnt, diff) {
    try {
      const latestVersion = docuemnt.version + 1;

      await this.models["editable_document"].updateById(docuemnt.id, {
        version: latestVersion
      });

      const historyData = {
        userId: this.userId,
        documentId: docuemnt.id,
        version: latestVersion,
        data: JSON.stringify(diff)
      };

      await this.models["document_history"].add(historyData);
    } catch (err) {
      this.logger.error(err);
    }
  }

  async saveDiffData({ editableDocId, diffData }) {
      console.log("Attempting to save diff data:", diffData);
      try {
          const latestDiffVersion = new Date().getTime();
          const historyData = {
              userId: this.userId,
              documentId: editableDocId,
              version: latestDiffVersion,
              data: JSON.stringify(diffData)
          };
          await this.models["document_history"].add(historyData);
          console.log("Saved history data:", historyData);
      } catch (error) {
          console.error("Failed to save diff data:", error);
      }
  }

  async syncDocDataFromDiffData({ editableDocId }) {
    try {
      const editableDoc = await this.models["editable_document"].getByKey("documentId", editableDocId);

      // Get unsynchronized data from db
      const unSyncedDiffList = await this.models["document_history"].findAll({
        attributes: ["id", "version", "data"],
        order: [["version", "ASC"]],
        where: {
          version: {
            [Op.gt]: editableDoc.version
          },
          documentId: editableDoc.documentId,
          userId: this.userId
        }
      });

      // No need for sync
      if (unSyncedDiffList.length == 0) return;

      // Local file data
      let deltaData = new Delta(this.getDocDataFromLocalFile(editableDoc.docHash));

      // Compose diff data
      deltaData = unSyncedDiffList.reduce((prev, current) => prev.compose(JSON.parse(current.data)), deltaData);

      // Save Data
      this.saveDocDataToLocalFile(editableDoc.docHash, JSON.stringify(deltaData));

      // Set the document version to the latest diff version
      await this.models["editable_document"].updateById(editableDoc.id, {
        version: unSyncedDiffList[unSyncedDiffList.length - 1].version
      });
    } catch (error) {
      this.logger.error(error);
    }
  }

  getLocalFilePath(docHash) {
    return path.join(DOCUMENT_PATH, `${docHash}.delta`);
  }

  getDocDataFromLocalFile(docHash) {
    const filePath = this.getLocalFilePath(docHash);

    let docData = [];

    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");

      if (data.length != 0) docData = JSON.parse(data);
    }

    return docData;
  }

  async saveDocDataToLocalFile(docHash, data) {
    try {
      const filePath = this.getLocalFilePath(docHash);

      fs.writeFile(filePath, data, (error) => {
        error && this.logger.error(error);
      });
    } catch (error) {
      this.logger.error(error);
    }
  }

  async exportEditableDocument({ docHash, docId }) {
    await this.syncDocDataFromDiffData({ editableDocId: docId });

    this.socket.emit(`exportEditableDocument.${docHash}`, this.getDocDataFromLocalFile(docHash));
  }

  async init() {
    this.socket.on("editableDocumentGet", async (data) => {
      try {
        await this.sendEditableDoc(data.id);
      } catch (err) {
        this.logger.error(err);
      }
    });

    this.socket.on("saveDelta", async (data) => {
      console.log("Received saveDelta with data:", data);
      try {
        // Emit the saveDelta event with the data.ops array
        this.$socket.emit('saveDelta', { documentId: this.documentId, ops: data.ops });
        console.log("saveDelta event emitted with data.ops:", data.ops);
        this.socket.emit('saveDeltaSuccess');
      } catch (error) {
        console.error("Error handling saveDelta:", error);
        this.socket.emit('saveDeltaFailure', {error: error.message});
      }
    });

    this.socket.on("editableDocumentGetOrCreateForDocument", async (data) => {
      try {
        await this.getOrCreateForDocument(data);
      } catch (err) {
        this.logger.error(err);
      }
    });

    this.socket.on("editableDocumentUpdate", async (data) => {
      try {
        if (data.id !== undefined && data.id !== 0) {
          await this.updateEditableDocument(data.id, data);
        } else {
          await this.addEditableDoc(data);
        }
      } catch (err) {
        this.logger.error(err);
        this.sendToast(err, "Error updating editable document", "Danger");
      }
    });

    this.socket.on("editableDocumentSilentUpdate", async ({ document, diff }) => {
      console.log(document);
      try {
        let doc;
        if (document.id !== undefined && document.id !== 0) {
          doc = await this.silentUpdateEditableDoc(document.id, document);
        } else {
          doc = await this.silentAddEditableDoc(document);
        }

        await this.saveHistoryData(doc, diff);
      } catch (err) {
        this.logger.error(err);
      }
    });

    this.socket.on("saveDiffData", (data) => {
      this.saveDiffData(data);
    });

    this.socket.on("syncDocDataFromDiffData", (data) => {
      this.syncDocDataFromDiffData(data);
    });

    this.socket.on("exportEditableDocument", (data) => {
      this.exportEditableDocument(data);
    });
  }
};