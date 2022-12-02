import {omitObjectAttributeSubset, pickObjectAttributeSubset} from "./utils";

function getCommentThread(root, comms){
    const children = comms.filter(c => c.referenceComment === root.hash);

    if(children.length === 0){
        return omitObjectAttributeSubset(root, ["referenceAnnotation", "referenceComment"]);
    }

    return  Object.fromEntries(Object.entries(root) + ["replies", children.map(c => getCommentThread(c, comms))]);
}

export function mergeAnnotationsAndComments(annos, comms) {
    const mapped = annos.map(anno => {
       const root_comm = comms.find(comm => comm.referenceAnnotation === anno.hash);

       let res = Object.fromEntries(Object.entries(anno));
       if(root_comm !== undefined){
           const comm_thread = getCommentThread(root_comm, comms);
           return Object.assign(res, {comment: comm_thread})
       }

       return res;
    });

    const unmapped = comms.filter(comm => comm.referenceAnnotation === null && comm.referenceComment === null);

    return [mapped, unmapped]
}