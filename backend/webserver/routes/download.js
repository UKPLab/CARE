/**
 * @author Linyin Huang
 */
const path = require("path");
/**
 * Register the routes for downloading the CSV file
 * @param {Server} server main server instance
 */
module.exports = function (server) {
  server.app.get("/download/temp/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, "..", "..", "temp", filename);
    res.setHeader("Content-Type", "text/csv");
    res.download(filePath, filename, (err) => {
      if (err) {
        res.status(404).send("File not found");
      }
      // TODO: Delete the file after download
    });
  });
};
