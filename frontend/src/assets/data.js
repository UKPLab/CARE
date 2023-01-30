import {omitObjectAttributeSubset, pickObjectAttributeSubset} from "./utils";

function getCommentThread(root, comms){
    const children = comms.filter(c => c.referenceComment === root.id);

    if(children.length === 0){
        return omitObjectAttributeSubset(root, ["referenceAnnotation", "referenceComment"]);
    }

    return Object.fromEntries(Object.entries(root).concat([["replies", children.map(c => getCommentThread(c, comms))]]));
}

export function mergeAnnotationsAndComments(annos, comms) {
    const mapped = annos.map(anno => {
       let res = Object.fromEntries(Object.entries(anno));

       const root_comm = comms.find(comm => comm.referenceAnnotation === anno.id);
       if(root_comm !== undefined){
           console.log("root comment", root_comm);

           const comm_thread = getCommentThread(root_comm, comms);

           console.log("comm thread", comm_thread);

           return Object.assign(res, {comment: comm_thread})
       }

       return res;
    });

    const unmapped = comms.filter(comm => comm.referenceAnnotation === null && comm.referenceComment === null)
        .map(comm => omitObjectAttributeSubset(comm, ["referenceAnnotation", "referenceComment"]));

    return [mapped, unmapped]
}