module.exports = {
  "tags": {
    "allowUnknownTags": true,
    "dictionaries": ["jsdoc", "closure"],
  },

  "source": {
    "include": ["./backend/webserver/sockets"],
    "includePattern": ".js$",
    "excludePattern": "(node_modules/|docs)"
  },
  plugins: ["/docs/jsdoc_plugins/socketEvent-plugin.js"],
  "opts": {
    "destination": ".",
    "recurse": true,
  }
};
