Download
--------

The downloading components provide a simple way to manage the download of individual data points.  
They take care of socket communication, timeouts, and emitting results back to the parent.  
Use them directly in your components whenever data needs to be fetched or exported.  

There are three main classes:

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

-----

**Usage hints:**

- Use **DownloadSingle** when you just need one payload.  
- Use **DownloadSet** when downloading multiple ids, and you want progress tracking.  
- Use **ExportSingle** for user-facing export buttons (CSV, JSON, …).  

All three handle socket subscribe/unsubscribe, error toasts, and timeouts automatically.
