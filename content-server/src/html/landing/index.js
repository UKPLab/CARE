
const { uploading } = require("./up");


if (document.querySelector('uploadapp')) {
  uploading(document, {assetRoot:document.URL});
} else {
  window.alert(
      'Page failed to load properly. Please contact the developers.'
    );
}