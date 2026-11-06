/** Bounded, read-only loading of one Annotator context; late acknowledgements are ignored. */
export function loadAnnotatorRecords() {
      const requestId = ++this.recordsRequestId;
      clearTimeout(this.recordsTimer);
      this.recordsLoaded = false;
      this.recordsStatus = "loading";
      this.$emit('update:data', null);
      let attempt = 0;
      const fetch = () => {
        if (requestId !== this.recordsRequestId) return;
        const currentAttempt = ++attempt;
        let settled = false;
        const failed = () => {
          if (settled || requestId !== this.recordsRequestId || currentAttempt !== attempt) return;
          settled = true;
          clearTimeout(this.recordsTimer);
          if (attempt < 3) {
            this.recordsTimer = setTimeout(fetch, 500 * attempt);
          } else {
            ++attempt;
            this.recordsStatus = "error";
            this.$emit('update:data', {loadError: true});
          }
        };
        this.recordsTimer = setTimeout(failed, 10000);
        this.$socket.emit("documentGetData", {
          documentId: this.documentId,
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId
        }, (res) => {
          if (settled || requestId !== this.recordsRequestId || currentAttempt !== attempt) return;
          if (!res?.success) { failed(); return; }
          settled = true;
          clearTimeout(this.recordsTimer);
          this.recordsLoaded = true;
          this.recordsStatus = "ready";
          this.emitStudyData();
        });
      };
      fetch();
}
