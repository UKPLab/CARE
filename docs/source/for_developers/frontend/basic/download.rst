Download
--------

.. warning::

   The **DownloadSingle**, **DownloadSet**, and **ExportSingle** components represent an older workflow.  
   They should **not** be used in new code. They are still documented below for clarification and legacy maintenance.  

   **Recommended:** Use direct callbacks with utilities like `JSZip <https://stuk.github.io/jszip/>`_ and 
   `FileSaver <https://github.com/eligrey/FileSaver.js/>`_ to build your own exports.  

   Example (recommended approach: building a ZIP with project data):

   .. code-block:: javascript

      import JSZip from "jszip";
      import FileSaver from "file-saver";
      import Quill from "quill";
      import {dbToDelta} from "editor-delta-conversion";

      async downloadAllData() {
        this.wait = true;
        const zip = new JSZip();

        // add some JSON files
        zip.file('tags.json', JSON.stringify(this.tags, null, 2));
        zip.file('tag_sets.json', JSON.stringify(this.tagSets, null, 2));
        zip.file('project.json', JSON.stringify(
          this.projects.filter(project => project.id === this.dataSelection.projectId),
          null, 2
        ));

        // request documents via socket with callbacks
        await Promise.all(
          this.studySessions.flatMap(session =>
            this.studySteps
              .filter(step => step.studyId === session.studyId)
              .map(step =>
                new Promise(resolve => {
                  this.$socket.emit("documentGetData", {
                    documentId: step.documentId,
                    studySessionId: session.id,
                    studyStepId: step.id,
                    history: true,
                  }, response => resolve(response));
                })
              )
          )
        );

        // build Quill delta + HTML
        const quill = new Quill(document.createElement("div"));
        const deltas = dbToDelta(this.edits);
        quill.setContents(deltas);
        zip.file("document.delta", JSON.stringify(deltas, null, 2));
        zip.file("html.html", quill.getSemanticHTML());
        zip.file("text.txt", quill.getText());

        // save archive
        zip.generateAsync({ type: "blob" })
          .then(content => FileSaver.saveAs(content, "export.zip"));

        this.wait = false;
      }

The downloading components provide a simple way to manage the download of individual data points.  
They take care of socket communication, timeouts, and emitting results back to the parent.  

These are the older three main classes:

**DownloadSingle** – A low-level component that requests one payload and waits for a single response.  
It is the most direct way to subscribe to a socket message pair (`req-msg` / `res-msg`) and emit the result.  

**DownloadSet** – Similar to *DownloadSingle*, but handles a sequence of ids.  
It tracks download progress, collects results, and emits them once complete.  
Useful for batch downloads of many items.  

**ExportSingle** – A wrapper around *DownloadSingle* that adds client-side export functionality (CSV, JSON, …).  
It uses a `post-process` hook to transform the response before exporting via the browser.

Example for exporting a single data point:

.. code-block:: html

    <ExportSingle
        ref="export"
        name="stats"
        req-msg="statsGetAll"
        res-msg="statsData"
        :post-process="x => x.statistics"
    />

.. code-block:: javascript

    import ExportSingle from "@/basic/download/ExportSingle.vue";

    export default {
      components: { ExportSingle },
      methods: {
        downloadAsCSV() {
          this.$refs.export.requestExport({ id: 42 }, "csv");
        }
      }
    }

