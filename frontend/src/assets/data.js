import {omitObjectAttributeSubset} from "./utils";

function getCommentThread(root, comms){
    const children = comms.filter(c => c.commentId === root.id);

    if(children.length === 0){
        return omitObjectAttributeSubset(root, ["annotationId", "commentId"]);
    }

    return Object.fromEntries(Object.entries(root).concat([["replies", children.map(c => getCommentThread(c, comms))]]));
}

export function mergeAnnotationsAndComments(annos, comms) {
    const mapped = annos.map(anno => {
       let res = Object.fromEntries(Object.entries(anno));

       const root_comm = comms.find(comm => comm.annotationId === anno.id);
       if(root_comm !== undefined){
           console.log("root comment", root_comm);

           const comm_thread = getCommentThread(root_comm, comms);

           console.log("comm thread", comm_thread);

           return Object.assign(res, {comment: comm_thread})
       }

       return res;
    });

    const unmapped = comms.filter(comm => comm.annotationId === null && comm.commentId === null)
        .map(comm => omitObjectAttributeSubset(comm, ["annotationId", "commentId"]));

    return [mapped, unmapped]
}