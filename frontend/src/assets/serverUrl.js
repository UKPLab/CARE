/**
 * Returns the URL of the server based on the build context.
 *
 * @returns {string}
 */
const getServerURL = () => {
  if (process.env.NODE_ENV !== 'production') {
      return import.meta.env.VITE_APP_SERVER_URL;
    } else {
      return window.location.protocol + "//" + window.location.host;
  }
};

export default getServerURL;