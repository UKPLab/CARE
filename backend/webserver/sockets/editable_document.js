const Socket = require("../Socket.js");
const fs = require("fs");
const path = require("path");

const DOCUMENT_PATH = `${__dirname}/../../../documents`;

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

      this.emit("editable_docRefresh", editable_doc);
      return editable_doc;
    } else {
      this.sendToast("You are not allowed to update this editable document", "Error", "Danger");
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
    this.emit("editable_docRefresh", newEditableDoc);

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
      this.emit("editable_docRefresh", editable_doc);
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
      this.emit("editable_docRefresh", editable_doc);
    } else {
      await this.addEditableDoc(data);
    }
  }

  /**
   * Save document history data
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

  /**
   * Save document data to a local file
   * @param doc
   * @param data
   * @returns {Promise<void>}
   */
  async saveDocumentData(hash, data) {
    try {
      const target = path.join(DOCUMENT_PATH, `${hash}`);

      fs.writeFile(target, data, (err) => {
        this.socket.emit("saveDocumentData", { success: !err, documentHash: hash });
      });
    } catch (err) {
      this.logger.error(err);
    }
  }

  async init() {
    this.socket.on("editableDocumentGet", async (data) => {
      try {
        await this.sendEditableDoc(data.id);
      } catch (err) {
        this.logger.error(err);
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

    this.socket.on("saveDocumentData", async ({ hash, data }) => {
      try {
        this.saveDocumentData(hash, data);
      } catch (err) {
        this.logger.error(err);
      }
    });
  }
};
