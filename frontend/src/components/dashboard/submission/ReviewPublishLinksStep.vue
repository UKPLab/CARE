<template>
  <div class="mb-3">
    <label for="text_format" class="form-label">
      <b>{{ $t('dashboard.publishModal.textFormat') }}</b>
    </label>
    <textarea
      id="text_format"
      :value="textFormat"
      class="form-control"
      rows="3"
      @input="$emit('update:textFormat', $event.target.value)"
    ></textarea>
    <div class="small">
      <p>
        <span>{{ $t('dashboard.publishModal.placeholderSessionLinks') }}<br /></span>
        <span v-if="linkCollection === 'studies'">
          {{ $t('dashboard.publishModal.placeholderUsername') }}
        </span>
      </p>
    </div>
  </div>

  <div class="mb-3">
    <label for="publishMethod" class="form-label">
      <b>{{ $t('dashboard.publishModal.linkCollection') }}</b>
    </label>
    <select
      id="publishMethod"
      :value="linkCollection"
      class="form-select"
      @change="$emit('update:linkCollection', $event.target.value)"
    >
      <option value="studies">{{ $t('dashboard.publishModal.basedOnStudies') }}</option>
      <option value="sessions">{{ $t('dashboard.publishModal.basedOnSessions') }}</option>
    </select>
  </div>

  <div class="mb-3">
    <p><b>{{ $t('dashboard.publishModal.links') }}</b></p>

    <ul v-if="linkCollection === 'studies'">
      <li
        v-for="doc in formattedStudies"
        :key="doc"
      >
        <b>{{ doc.document.name }} ({{ doc.document.firstName }} {{ doc.document.lastName }})</b>
        <ul>
          <li
            v-for="session in doc.sessions"
            :key="session"
          >
            {{ session.firstName }} {{ session.lastName }} (
            <a
              :href="session.link"
              target="_blank"
            >
              {{ session.link }}
            </a>)
          </li>
        </ul>
      </li>
    </ul>

    <ul v-else-if="linkCollection === 'sessions'">
      <li
        v-for="session in formattedSessions"
        :key="session"
      >
        <b>{{ session[0].firstName }} {{ session[0].lastName }}</b>
        <ul>
          <li
            v-for="s in session"
            :key="s"
          >
            {{ s.document.documentName }} (
            <a
              :href="s.link"
              target="_blank"
            >
              {{ s.link }}
            </a>)
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<script>
/**
 * Review publishing, step 4: the message text and a preview of the review
 * links, grouped per reviewed document or per reviewer.
 *
 * @author Dennis Zyska, Linyin Huang
 */
export default {
  name: "ReviewPublishLinksStep",
  props: {
    /** Message template with ~SESSION_LINKS~ and ~USERNAME~ placeholders. */
    textFormat: {type: String, required: true},
    /** "studies" (per reviewed document) or "sessions" (per reviewer). */
    linkCollection: {type: String, required: true},
    formattedStudies: {type: Array, required: true},
    formattedSessions: {type: Object, required: true},
  },
  emits: ["update:textFormat", "update:linkCollection"],
};
</script>
