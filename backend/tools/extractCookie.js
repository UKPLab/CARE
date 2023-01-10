/* Cookie Extractor

Extract data from set cookie header

Author: Dennis Zyska <dennis@zyska.org>
Source: Mainly adapted from https://alligator.io/nodejs/express-cookies
*/

const extractCookie = (cookie) => {
 const rawCookie = cookie.split('; ');
 const parsedCookies = {};

 rawCookie.forEach(raw=>{
 const parsedCookie = raw.split('=');
  parsedCookies[parsedCookie[0]] = parsedCookie[1];
 });
 return parsedCookies;
};

module.exports = extractCookie;
