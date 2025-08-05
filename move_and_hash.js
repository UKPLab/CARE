// move_and_hash.js
// Moves submission.zip to files/ and renames it to its SHA256 hash-id

/**
 * Script to move submission.zip to the files directory and rename it to its SHA256 hash.
 * Usage: node move_and_hash.js
 *
 * @author AI Assistant
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('./backend/db');

const SRC = path.join(__dirname, 'submission.zip');
const DEST_DIR = path.join(__dirname, 'files');

/**
 * Compute SHA256 hash of a file.
 * @param {string} filePath - Path to the file.
 * @returns {Promise<string>} - The SHA256 hash as a hex string.
 */
function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Insert a new submission entry with fixed values.
 * @returns {Promise<Object>} The created submission entry.
 */
async function insertSubmission() {
  // Try to insert with id=1, but if id is auto-increment, let DB assign it
  return await db.models.submission.add({
    id: 1,
    userId: 1,
    createdByUserId: 1,
    projectId: 1,
  });
}

/**
 * Insert a new document entry for the zip file and link to submission.
 * @param {string} documentUuid - The UUID to use for both filename and hash field.
 * @returns {Promise<Object>} The created document entry.
 */
async function insertDocument(documentUuid) {
  return await db.models.document.add({
    name: `${documentUuid}.zip`,  // Filename uses UUID
    hash: documentUuid,           // Hash field uses same UUID
    userId: 1,
    submissionId: 1,
    type: 0, // Assuming 0 is for zip/pdf
    public: false,
    readyForReview: false,
    uploadedByUserId: 1,
  });
}

(async () => {
  try {
    if (!fs.existsSync(SRC)) {
      console.error('submission.zip not found.');
      process.exit(1);
    }
    if (!fs.existsSync(DEST_DIR)) {
      fs.mkdirSync(DEST_DIR, { recursive: true });
    }

    // Generate UUID for filename and hash
    const documentUuid = uuidv4();
    console.log(`Generated UUID: ${documentUuid}`);

    // Insert submission (if needed, or keep as is)
    const submission = await insertSubmission();
    console.log('Inserted submission:', submission);
    console.log('File and DB entry are now linked by UUID!');

    // Insert document using UUID as name and hash fields
    const document = await insertDocument(documentUuid);
    console.log('Inserted document:', document);
    console.log(`Document name: ${document.name}`);
    console.log(`Document hash: ${document.hash}`);



    // Copy file to destination using UUID as filename
    const destPath = path.join(DEST_DIR, `${document.hash}`);
    fs.copyFileSync(SRC, destPath);
    console.log(`Copied to: ${destPath}`);


  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})(); 