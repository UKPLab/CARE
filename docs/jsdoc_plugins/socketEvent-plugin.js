exports.defineTags = function (dictionary) {
  dictionary.defineTag("socketEvent", {
    mustHaveValue: true,
    onTagged: function (doclet, tag) {
      const socketText = `**Socket Event**: \`${tag.value}\`\n\n`;
      doclet.description = socketText + (doclet.description || "");
    }
  });
};
