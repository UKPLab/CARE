import {FileSaver} from "file-saver"; //required for window.saveAs to work
import Papa from "papaparse";

// src: https://stackoverflow.com/questions/17781472/how-to-get-a-subset-of-a-javascript-objects-properties
export function pickObjectAttributeSubset(obj, keys) {
    return Object.fromEntries(keys.filter(key => key in obj).map(key => [key, obj[key]]));
}

// src: https://stackoverflow.com/questions/17781472/how-to-get-a-subset-of-a-javascript-objects-properties
export function omitObjectAttributeSubset(obj, keys) {
    return Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));
}

export function overrideObjectAttributes(obj_orig, obj_over) {
    return Object.fromEntries(Object.entries(obj_orig).map(([key, value]) => [key, key in obj_over ? obj_over[key] : value]));
}

export function objectsToCSV(objs) {
    return Papa.unparse(objs);
}

export function objectsToJSON(objs) {
    return JSON.stringify(objs);
}

export function objectsToTXT(objs) {
    return objs.map(o => Object.entries(o).map(([k, v]) => {
        if(typeof v === "object" && v !== null){
          return `${k}\n${objectsToTXT([v])}`;
        } else if(v === null) {
            return `${k}:-`;
        } else {
            return `${k}:  ${v}`;
        }
    }).join("\n")
    ).join("\n\n");
}

export function downloadObjectsAs(objs, name, file_type) {
    let data;
    let httpType;
    if(file_type === "csv"){
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

// src: https://stackoverflow.com/questions/6229197/how-to-know-if-two-arrays-have-the-same-values/55614659#55614659
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