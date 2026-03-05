/**
 * Emergency CLI: reset admin password in DB.
 *
 * Usage:
 *   make admin-password
 * 
 * @author Andrii Nikitin
 */

'use strict';

const { genSalt, genPwdHash } = require("../utils/auth");
const db = require("../db");

function readHidden(promptText) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(promptText);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";

    function onData(ch) {
      ch = ch.toString();

      if (ch === "\n" || ch === "\r" || ch === "\u0004") {
        stdout.write("\n");
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        resolve(value);
      } else if (ch === "\u0003") { // Ctrl+C
        process.exit(1);
      } else if (ch === "\u007f") { // Backspace
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    }

    stdin.on("data", onData);
  });
}

function validatePassword(pwd) {
  // 0x21–0x7E: only printable ASCII without space
  const asciiPrintableNoSpace = /^[\x21-\x7E]+$/;

  if (!asciiPrintableNoSpace.test(pwd)) {
    throw new Error(
      "Password must contain only printable ASCII characters (no emojis/unicode)."
    );
  }

  if (pwd.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }
}   

async function main() {
  // turn off SQL logs
  if (db?.sequelize?.options) db.sequelize.options.logging = false;

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error("ERROR: ADMIN_EMAIL is not set. Check .env");
    process.exit(1);
  }

  const BOLD = "\x1b[1m";
  const YELLOW = "\x1b[33m";
  const RESET = "\x1b[0m";

  const p1 = await readHidden("New password: ");
  const p2 = await readHidden("Repeat password: ");

  if (p1 !== p2) {
    console.error("ERROR: Passwords do not match");
    process.exit(1);
  }
  if (!p1.trim()) {
    console.error("ERROR: Password cannot be empty");
    process.exit(1);
  }

  const newPwd = p1;
  validatePassword(newPwd);

  const User = db.models?.user || db.models?.User;
  if (!User) {
    console.error(`ERROR: Cannot find User model. Available models: ${Object.keys(db.models || {}).join(", ")}`);
    process.exit(1);
  }

  const admin = await User.findOne({ where: { email: adminEmail } });
  if (!admin) {
    console.error(`ERROR: Admin user not found with email=${adminEmail}`);
    process.exit(1);
  }

  const salt = genSalt();
  const passwordHash = await genPwdHash(newPwd, salt);

  admin.passwordHash = passwordHash;
  admin.salt = salt;
  await admin.save();

  console.log(`\nAdmin password updated for ${adminEmail}`);
  console.warn(`${BOLD}${YELLOW}Emergency reset! please change the password again via the UI afterwards.${RESET}\n`);

  if (db.sequelize?.close) await db.sequelize.close();
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});