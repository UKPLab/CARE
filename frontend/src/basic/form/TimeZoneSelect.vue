<template>
  <div
    class="care-tz"
    @keydown.esc.stop.prevent="$emit('back')"
  >
    <div class="care-sub__head">
      <BasicButton
        class="btn-icon care-sub__back"
        :title="$t('common.back')"
        :aria-label="$t('common.back')"
        @click="$emit('back')"
      >
        <LoadIcon icon-name="chevron-left" :size="12" />
      </BasicButton>
      <div class="care-sub__titles">
        <span class="care-sub__title">{{ $t('common.datePicker.timeZone') }}</span>
        <span class="care-sub__hint">{{ $t('common.datePicker.zones.hint') }}</span>
      </div>
    </div>

    <div class="care-tz__search">
      <LoadIcon class="care-tz__search-icon" icon-name="search" :size="12" />
      <input
        ref="search"
        v-model="query"
        type="search"
        autocomplete="off"
        spellcheck="false"
        :placeholder="$t('common.datePicker.zones.search')"
        :aria-label="$t('common.datePicker.zones.search')"
        @keydown.down.prevent="focusItem(0)"
        @keydown.enter.prevent="pickFirst"
      >
    </div>

    <div
      ref="list"
      class="care-tz__list"
      role="listbox"
      :aria-label="$t('common.datePicker.timeZone')"
      @keydown="onListKeydown"
    >
      <template v-for="section in sections" :key="section.key">
        <div class="care-tz__section">{{ section.title }}</div>
        <button
          v-for="item in section.items"
          :key="`${section.key}-${item.id}`"
          type="button"
          role="option"
          class="care-tz__item"
          :class="{ 'is-selected': item.id === current }"
          :aria-selected="item.id === current ? 'true' : 'false'"
          :title="item.id"
          @click="pick(item.id)"
        >
          <LoadIcon
            v-if="item.id === current || item.id === device"
            class="care-tz__check"
            :icon-name="item.id === current ? 'check2' : 'laptop'"
            :size="13"
          />
          <span v-else class="care-tz__check"></span>
          <span class="care-tz__names">
            <span class="care-tz__city">{{ item.city }}</span>
            <span v-if="item.region || item.id === device" class="care-tz__region">
              {{ [item.region, item.id === device ? $t('common.datePicker.zones.device') : ''].filter(Boolean).join(' · ') }}
            </span>
          </span>
          <span class="care-tz__offset">{{ item.offset }}</span>
        </button>
      </template>
      <p v-if="!sections.length" class="care-tz__empty">{{ $t('common.noMatches') }}</p>
    </div>
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import BasicButton from "@/basic/Button.vue";
import {deviceTimeZone, formatOffset, listTimeZones, offsetAt, splitZoneId} from "@/basic/form/timeZone";

const searchable = (text) => text.toLowerCase().replace(/−/g, "-").replace(/_/g, " ");

/**
 * Searchable list of all time zones, sorted by UTC offset. Offsets are shown for the selected
 * moment (`at`), so a July date shows summer offsets. Picking the device zone emits null, which
 * means "follow the device" (also after travelling).
 */
export default {
  name: "TimeZoneSelect",
  components: {LoadIcon, BasicButton},
  props: {
    /** Chosen zone id, or null for the device zone. */
    modelValue: {type: String, required: false, default: null},
    /** Timestamp the offsets are computed for. */
    at: {type: Number, required: true},
  },
  emits: ["update:modelValue", "back"],
  data() {
    return {
      query: "",
      device: deviceTimeZone(),
    };
  },
  computed: {
    current() {
      return this.modelValue || this.device;
    },
    items() {
      return listTimeZones()
        .map((id) => {
          const minutes = offsetAt(id, this.at);
          const offset = formatOffset(minutes);
          const {city, region} = id === "UTC" ? {city: "UTC", region: ""} : splitZoneId(id);
          return {
            id,
            city,
            region,
            minutes,
            offset,
            // "UTC+2" also matches "+2", "gmt+2", "utc+02"
            haystack: searchable(`${id} ${city} ${region} ${offset} ${offset.replace("UTC", "GMT")} ${offset.replace(/([+−])(\d)(?!\d)/, (_, sign, digit) => `${sign}0${digit}`)}`),
          };
        })
        .sort((a, b) => a.minutes - b.minutes || a.city.localeCompare(b.city));
    },
    sections() {
      const words = searchable(this.query).trim().split(/\s+/).filter(Boolean);
      const byId = (id) => this.items.find((item) => item.id === id);
      if (words.length) {
        const found = this.items.filter((item) => words.every((word) => item.haystack.includes(word)));
        return found.length ? [{key: "found", title: this.$t("common.datePicker.zones.results"), items: found}] : [];
      }
      const pinned = [...new Set([this.current, this.device, "UTC"])].map(byId).filter(Boolean);
      const pinnedIds = new Set(pinned.map((item) => item.id));
      return [
        {key: "pinned", title: this.$t("common.datePicker.zones.suggested"), items: pinned},
        {key: "all", title: this.$t("common.datePicker.zones.all"), items: this.items.filter((item) => !pinnedIds.has(item.id))},
      ];
    },
  },
  mounted() {
    this.$refs.search?.focus({preventScroll: true});
  },
  methods: {
    pick(id) {
      this.$emit("update:modelValue", id === this.device ? null : id);
      this.$emit("back");
    },
    pickFirst() {
      const first = this.sections[0]?.items[0];
      if (first) this.pick(first.id);
    },
    buttons() {
      return [...(this.$refs.list?.querySelectorAll(".care-tz__item") || [])];
    },
    focusItem(index) {
      const list = this.buttons();
      list[Math.max(0, Math.min(index, list.length - 1))]?.focus();
    },
    /** Up/Down between zones, Up from the first one back to the search field. */
    onListKeydown(event) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const list = this.buttons();
      const index = list.indexOf(document.activeElement);
      if (event.key === "ArrowUp" && index <= 0) {
        this.$refs.search?.focus();
        return;
      }
      this.focusItem(index + (event.key === "ArrowDown" ? 1 : -1));
    },
  },
};
</script>

<style scoped>
.care-tz__search {
  display: flex;
  align-items: center;
  gap: .5rem;
  margin-bottom: .5rem;
  padding: 0 .6rem;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--care-radius-md);
}

.care-tz__search:focus-within {
  border-color: var(--care-primary);
  box-shadow: var(--care-focus-ring);
}

.care-tz__search-icon {
  color: var(--bs-secondary-color);
}

.care-tz__search input {
  flex: 1 1 auto;
  min-width: 0;
  padding: .4rem 0;
  font-size: .85rem;
  color: var(--bs-body-color);
  background: transparent;
  border: 0;
  outline: none;
}

.care-tz__list {
  height: 19rem;
  margin: 0 -.25rem;
  padding: 0 .25rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.care-tz__section {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: .35rem .4rem .25rem;
  font-size: .68rem;
  font-weight: 600;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--bs-secondary-color);
  background: var(--bs-body-bg);
}

.care-tz__item {
  display: flex;
  align-items: center;
  gap: .5rem;
  width: 100%;
  padding: .35rem .4rem;
  text-align: left;
  color: var(--bs-body-color);
  background: transparent;
  border: 0;
  border-radius: var(--care-radius-md);
  cursor: pointer;
  transition: background-color var(--care-dur-fast) var(--care-ease);
}

.care-tz__item:hover,
.care-tz__item:focus-visible {
  background: var(--bs-tertiary-bg);
  outline: none;
}

.care-tz__item:focus-visible {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--care-primary) 55%, transparent);
}

.care-tz__item.is-selected {
  background: color-mix(in srgb, var(--care-primary) 10%, transparent);
}

.care-tz__check {
  flex: 0 0 1rem;
  color: var(--bs-secondary-color);
}

.care-tz__item.is-selected .care-tz__check {
  color: var(--care-primary);
}

.care-tz__names {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  line-height: 1.25;
}

.care-tz__city,
.care-tz__region {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.care-tz__city {
  font-size: .82rem;
  font-weight: 500;
}

.care-tz__item.is-selected .care-tz__city {
  font-weight: 600;
  color: var(--care-primary);
}

.care-tz__region {
  font-size: .7rem;
  color: var(--bs-secondary-color);
}

.care-tz__offset {
  flex: 0 0 auto;
  font-size: .72rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--bs-secondary-color);
}

.care-tz__empty {
  margin: 1.5rem 0;
  font-size: .8rem;
  text-align: center;
  color: var(--bs-secondary-color);
}

@media (prefers-reduced-motion: reduce) {
  .care-tz__item {
    transition: none;
  }
}
</style>
