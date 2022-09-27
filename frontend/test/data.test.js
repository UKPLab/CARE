import { withSetup } from './test-utils'

import {Annotation, toCSV} from "../src/data/annotation"
import {Comment} from "../src/data/comment"

function createTestdata() {
  const a1 = new Annotation("testid1", "docid1", "this text has been selected.1", "{}", null, 1, ["tag1"]);
  const a2 = new Annotation("testid2", "docid2", "this text has been selected.2", "", null, 2, ["tag2"]);
  const a3 = new Annotation("testid3", "docid3", "this text has been selected.3", "", null, 3, ["tag3"]);
  const testAnnos = [a1, a2, a3];

  const c1 = new Comment("cid1","comment1", "testid1", "someid");
  const c2 = new Comment("cid2","comment2", "testid2", "");
  const c3 = new Comment("cidX","commentX", "testidX", "");
  const testComms = {
    "testid1": c1,
    "testid2": c2,
    "testidX": c3
  };

  a1.comment = c1;
  a2.comment = c2;

  const nonNullFieldsAnno = ["document_id", "id", "state", "text", "comment"];
  const nonNullFieldsComm = ["id", "text", "referenceAnnotation", "referenceComment"];

  return [testAnnos, testComms, nonNullFieldsAnno, nonNullFieldsComm];
}

function csvStringToObject(csv, sep=",", linebr="\n"){
  const rows = csv.split(linebr).map(r => r.split(sep));

  return [rows[0].map(h => h.trim()), rows.slice(1).map(r => {
    return Object.fromEntries(r.map((e, i) => [rows[0][i].trim(), e.trim()]));
  })];
}

function validateCsv(csvString, annos, annoSubfields=null, comms=null, commSubfields=null){
  const [header, rows] = csvStringToObject(csvString);

  // edge case
  if(annos.length === 0){
    return rows.length === 0;
  }

  // check header included (using first as schema)
  const afields = annoSubfields === null ? Object.keys(annos[0]).filter(x => x !== "comment") : annoSubfields.filter(x => x !== "comment") ;
  expect(header).containSubset(afields);

  // check comment header
  if(comms !== null && Object.keys(comms).length > 0){
    let cfields = commSubfields === null ? Object.keys(comms[Object.keys(comms)[0]]) : commSubfields;
    cfields = cfields.map(f => "comment_" + f);

    expect(header).containSubset(cfields);
  }

  // check for each annotation that there is a matching row
  annos.forEach(a => {
    const aEntries = Object.entries(a).filter(e => e[0] !== "comment" && (annoSubfields === null || annoSubfields.includes(e[0])));

    expect(
        rows.filter(r => {
          const rowEntries = Object.entries(r).filter(e => annoSubfields === null || annoSubfields.includes(e[0]));

          return rowEntries.filter(e => a[e[0]] !== undefined && a[e[0]] === e[1]).length === aEntries.length;
        }).length)
        .to.greaterThan(0, "Some annotation does not have a matching row in the resulting table");
  });

  // check for each anno in the table with a match in the comments that the fields in the csv match
  if(comms !== null && Object.keys(comms).length > 0){
    rows.forEach(r => {
      const aid = r.id;
      const c = comms[aid];

      if(c !== undefined){
        const cEntries = Object.entries(c).filter(e => commSubfields === null || commSubfields.includes(e[0]));

        cEntries.forEach(e => {
          expect(r["comment_" + e[0]] !== undefined).to.true;
          expect(r["comment_" + e[0]]).to.equal(e[1], "on field " + e[0]);
        });
      }
    });
  }

  // this does not check if any weird fields were added to the CSV, but that's not as critical for now
}

test('data/annotation.toCSV', async () => {
  it("Base Case", async () => {
    const [testAnnos, testComms, fieldsA, fieldsC] = createTestdata();

  // annotation only, all fields (!= null)
  const res = toCSV(testAnnos, fieldsA);
  const resText = await res.toString(true, true);

  validateCsv(resText, testAnnos, fieldsA);
  });

  it("Comment Case", async () => {
    const [testAnnos, testComms, fieldsA, fieldsC] = createTestdata();

  // annotation with comment, all fields
  const res = toCSV(testAnnos, fieldsA, fieldsC);
  const resText = await res.toString(true, true);

  validateCsv(resText, testAnnos, fieldsA, testComms, fieldsC);
  });
});
