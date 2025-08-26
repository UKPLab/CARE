import { FileSaver } from "file-saver"; // DO NOT delete this import, required for window.saveAs to work
import Papa from "papaparse";


/**
 * Returns a copy of the object, for which only the provided attributes by keys are included (whitelisting).
 * src: https://stackoverflow.com/questions/17781472/how-to-get-a-subset-of-a-javascript-objects-properties
 *
 * @param obj the object to be reduced (remains unchanged)
 * @param keys the keys to be included
 * @returns {Object}
 */
export function pickObjectAttributeSubset(obj, keys) {
    return Object.fromEntries(keys.filter(key => key in obj).map(key => [key, obj[key]]));
}

/**
 * Returns a copy of the object, for which only the attributes are included, which do not match any of the keys
 * (blacklisting).
 * src: https://stackoverflow.com/questions/17781472/how-to-get-a-subset-of-a-javascript-objects-properties
 *
 * @param obj the object to be reduced (remains unchagned)
 * @param keys the keys to NOT be included
 * @returns {Object}
 */
export function omitObjectAttributeSubset(obj, keys) {
    return Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));
}

/**
 * Returns a copy of the first argument object, where the attributes are replaced by the contents of the second
 * argument object, iff the attribute is present in the latter.
 *
 * @param obj_orig object to be copied
 * @param obj_over object to override attributes of the first object
 * @returns {Object}
 */
export function overrideObjectAttributes(obj_orig, obj_over) {
    return Object.fromEntries(Object.entries(obj_orig).map(([key, value]) => [key, key in obj_over ? obj_over[key] : value]));
}

/**
 * Returns a CSV version of the provided object. Requires Papa parse formatting.
 *
 * @param objs
 * @returns {*}
 */
export function objectsToCSV(objs) {
    return Papa.unparse(objs);
}

/**
 * Returns a JSON string of the provided objects (including pretty printing).
 *
 * @param objs
 * @returns {string}
 */
export function objectsToJSON(objs) {
    return JSON.stringify(objs, null, 2);
}

/**
 * Exports a list of objects into a single string, where nested objects are visualized by indentation.
 *
 * @param objs
 * @returns {String}
 */
export function objectsToTXT(objs) {
    return objs.map(o => Object.entries(o).map(([k, v]) => {
            if (typeof v === "object" && v !== null) {
                return `${k}\n${objectsToTXT([v])}`;
            } else if (v === null) {
                return `${k}:-`;
            } else {
                return `${k}:  ${v}`;
            }
        }).join("\n")
    ).join("\n\n");
}

/**
 * Downloads the provided objects by the given file type under the given file name.
 *
 * @param objs objects to be downloaded in the browser
 * @param name name of the resulting file
 * @param file_type the type of the file, either {"csv" | "json" | "txt"}
 */
export function downloadObjectsAs(objs, name, file_type) {
    let data;
    let httpType;
    if (file_type === "csv") {
        data = objectsToCSV(objs);
        httpType = "text/csv";
    } else if (file_type === "json") {
        data = objectsToJSON(objs);
        httpType = "application/json";
    } else if (file_type === "txt") {
        data = objectsToTXT(objs);
        httpType = "text/plain";
    } else {
        throw `Invalid argument '${file_type}' passed to downloadObjectsAs`;
    }

    window.saveAs(new Blob([data], {type: `${httpType};charset=utf-8`}), `${name}.${file_type}`)
}

/**
 * Checks whether two arrays are identical.
 * src: https://stackoverflow.com/questions/6229197/how-to-know-if-two-arrays-have-the-same-values/55614659#55614659
 *
 * @param a1
 * @param a2
 * @returns {boolean}
 */
export function arraysContainSameElements(a1, a2) {
    const superSet = {};
    for (const i of a1) {
        const e = i + typeof i;
        superSet[e] = 1;
    }

    for (const i of a2) {
        const e = i + typeof i;
        if (!superSet[e]) {
            return false;
        }
        superSet[e] = 2;
    }

    for (let e in superSet) {
        if (superSet[e] === 1) {
            return false;
        }
    }

    return true;
}

/**
 * Returns a human readable time string representing the time difference between two timestamps. The  string
 * adapts to the magnitude of the difference.
 *
 * @param start
 * @param end
 * @returns {string}
 */
export function getTimeDiffString(start, end) {
    let delta = Math.abs(end - start) / 1000;

    const days = Math.floor(delta / 86400);
    delta -= days * 86400;

    const hours = Math.floor(delta / 3600) % 24;
    delta -= hours * 3600;

    const minutes = Math.floor(delta / 60) % 60;
    delta -= minutes * 60;

    const seconds = Math.floor(delta % 60);

    if (days > 0) {
        return `${days} day${days > 1 ? "s" : ""}`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? "s" : ""} and ${minutes} minute${minutes > 1 ? "s" : ""}`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? "s" : ""}`;
    } else {
        return `${seconds} second${seconds > 1 ? "s" : ""}`;
    }
}

/**
 * Downloads a document as a file.
 * @param content the written content inside of the document
 * @param fileName the name of the file
 * @param fileType the type of the file
 */
export function downloadDocument(content, fileName, fileType = "") {
    let typeSet;
    switch (fileType) {
        case "PDF":
            typeSet = "application/pdf";
            // Ensure fileName ends with .pdf
            fileName = fileName.replace(/\.pdf$/i, "") + ".pdf"; // Remove any trailing .pdf and add .pdf
            break;
        case "html":
            typeSet = "text/html;charset=utf-8";
            break;
        case "json":
            typeSet = "application/json;charset=utf-8";
            break;
        case "csv":
            typeSet = "text/csv;charset=utf-8";
            break;
        case "txt":
        default:
            typeSet = "text/plain;charset=utf-8";
            break;
    }

    const blob = new Blob([content], {type: typeSet});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.setAttribute("href", url);
    anchor.setAttribute("target", "_blank");
    anchor.style.visibility = "hidden";
    anchor.setAttribute("download", fileName);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}


/**
 * Sort the data in a graph according to a previous key
 * @param key Key to sort the data
 * @returns {[]}
 */
export const sortGraph = function (key) {
    if (!key) {
        return this;
    }
    const data = this;
    const sorted = [];
    let current = data.find(item => item[key] === null);

    // find next element and add it to the sorted array
    while (current) {
        sorted.push(current);
        current = data.find(item => item[key] === current.id);
    }

    return sorted;
}

/**
 * This function sorts a list of objects according to the provided list of sorters objects.
 * @param arrayToSort list of objects to sort
 * @param sortList list of objects with the keys "type" and "key" to sort the list
 * @returns {[]}
 */
export const sorter = function(arrayToSort, sortList) {
    if (!sortList) {
        return arrayToSort;
    }
    let sortedList = arrayToSort;
    for (let sort of sortList) {
        switch(sort.type) {
            case "graph":
                sortedList = sortGraph.call(sortedList, sort.key);
                break;
            default:
                break;
        }
    }
    return sortedList;

}

/**
 * Extracts text content from a PDF document using PDF.js
 * @param {Object} pdfDocument - The PDF.js document object
 * @returns {Promise<string>} A promise that resolves to the extracted text
 */
export async function extractTextFromPDF(pdfDocument) {
    let fullText = '';
    
    // Loop through all pages
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Extract text from the page and normalize whitespace
        const pageText = textContent.items
            .map(item => item.str)
            .join(' ')
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
            
        fullText += pageText + '\n';
    }
    
    return fullText;
}

/**
 * Fetches JSON documents from the documents table that match a specific key in their content.
 * @param {Object} socket - The socket.io client instance for communication with the backend.
 * @param {Array} docs - An array of document configurations with 'id' and 'name' properties.
 * @param {string} key - The key to search for in the JSON documents.   
 * @return {Promise<Array>} A promise that resolves to an array of document IDs and names.
 */
export async function fetchJsonWithKey(socket, docs, key) {
    const documentIds = [];
    for (const config of docs) {
        await new Promise((resolve) => {
          socket.emit("documentGet", { documentId: config.id }, (res) => {
            if (res && res.data && res.data.file) {
              let fileContent;
              if (res.data.file instanceof ArrayBuffer) {
                fileContent = new TextDecoder().decode(new Uint8Array(res.data.file));
              } else {
                fileContent = res.data.file.toString();
              }

              try {
                const jsonContent = JSON.parse(fileContent);
                if (jsonContent.type === key) {
                  documentIds.push({ value: config.id, name: config.name });
                }
              } catch (parseError) {
                console.error(`Error parsing JSON config for document ${config.id}:`, parseError);
              }
            }
            
            resolve();
          });
        });
      }

      return documentIds;
}