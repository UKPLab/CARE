// frontend/version-writer.js
const fs = require('fs');
const { execSync } = require('child_process');

let commitHash;
let versionTag = null;
const ciCommitSha = process.env.TAG_COMMIT;
const ciVersionTag = process.env.CI_COMMIT_TAG;

if (ciCommitSha) {
    // 1. CI Pipeline Execution (Highest Priority)
    // GitLab CI environment variables are available via process.env
    commitHash = ciCommitSha;
    versionTag = ciVersionTag;
    console.log(`Using CI Commit SHA: ${commitHash}`);

} else {
    // 2.  Local Execution (Fallback)
    try {
        // Execute the Git command to get the short SHA from the parent repo
        // This is necessary because the CI variables aren't set.
        commitHash = execSync('git -C .. rev-parse --short HEAD').toString().trim();
        
        // Check for an exact matching tag locally
        try {
            versionTag = execSync('git -C .. describe --tags --exact-match').toString().trim();
        } catch (error) {
            versionTag = null; 
        }
        console.log(`Using Local Git Commit SHA: ${commitHash}`);

    } catch (error) {
        // 3. True Fallback (Non-Git environment, e.g., CI without Git, or a simple deploy)
        console.error('Failed to read Git version locally. Falling back to development tag.');
        commitHash = 'development';
    }
}

// Write the final version information
const content = `
  export const COMMIT_SHA = '${commitHash}';
  export const VERSION_TAG = ${versionTag ? `'${versionTag}'` : 'null'};
  // APP_VERSION is the tag if it exists, otherwise the commit SHA or 'development'
  export const APP_VERSION = VERSION_TAG || COMMIT_SHA;
`;

fs.writeFileSync('./src/version.js', content);