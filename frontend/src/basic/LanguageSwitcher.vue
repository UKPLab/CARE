<template>
    <div :class="['language-switcher', { 'language-switcher--standalone': standalone }]">
        <div class="btn-group" role="group">
            <button type="button" class="btn btn-sm btn-outline-primary dropdown-toggle language-toggle"
                :disabled="disabled" data-bs-toggle="dropdown" aria-expanded="false" :title="$t('common.language')">
                <span class="language-flag">
                    <img v-if="currentLanguage?.flagImage" :src="currentLanguage.flagImage" :alt="currentLanguage.code"
                        class="flag-image" />
                    <span v-else>{{ currentLanguage?.flag || '🌐' }}</span>
                </span>
                <span class="language-name">{{ currentLanguageName }}</span>
            </button>
            <ul class="dropdown-menu language-menu">
                <li v-for="lang in sortedLanguages" :key="lang.code">
                    <a class="dropdown-item d-flex align-items-center justify-content-between" href="#"
                        @click.prevent="setLanguage(lang.code)" :class="{ active: $i18n.locale === lang.code }">
                        <span class="d-flex align-items-center gap-2">
                            <span class="language-flag">
                                <img v-if="lang.flagImage" :src="lang.flagImage" :alt="lang.code" class="flag-image" />
                                <span v-else>{{ lang.flag || '🌐' }}</span>
                            </span>
                            <span>{{ lang.name }}</span>
                        </span>
                        <span v-if="$i18n.locale === lang.code">✓</span>
                    </a>
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
import { normalizeLocale, setStoredLocale, SUPPORTED_LOCALES } from "@/assets/locale.js";

export default {
    name: "LanguageSwitcher",
    props: {
        standalone: {
            type: Boolean,
            required: false,
            default: false,
        },
        /** When false, only updates $i18n (preview); parent persists to localStorage on confirm. */
        persist: {
            type: Boolean,
            default: true,
        },
        disabled: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {
            languages: SUPPORTED_LOCALES,
        };
    },
    computed: {
        currentLanguage() {
            return (
                this.languages.find((lang) => lang.code === this.$i18n.locale) || null
            );
        },
        sortedLanguages() {
            return [...this.languages].sort((a, b) =>
                a.name.localeCompare(b.name)
            );
        },
        currentLanguageName() {
            return this.currentLanguage
                ? this.currentLanguage.name
                : this.$t('common.language');
        },
    },
    methods: {
        setLanguage(locale) {
            if (this.disabled) {
                return;
            }
            const normalized = normalizeLocale(locale);
            if (!normalized) {
                return;
            }
            this.$i18n.locale = normalized;
            if (this.persist) {
                setStoredLocale(normalized);
            }
        },
    },
};
</script>

<style scoped>
.language-switcher {
    display: flex;
    align-items: center;
    height: 36px;
    margin-right: 0.5rem;
}

.language-switcher--standalone {
    position: fixed;
    top: 0.55rem;
    left: 1rem;
    z-index: 1031;
    margin-right: 0;
}

.language-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    min-width: 116px;
    justify-content: center;
}

.language-menu {
    min-width: 170px;
}

.language-name {
    line-height: 1;
}

.language-flag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.2em;
    height: 1.2em;
}

.flag-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
}
</style>