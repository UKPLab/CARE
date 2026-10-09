import { normalizeName, staticClasses } from './template-utils.js'

export default {
    meta: {
        type: 'suggestion',
        schema: [],
        messages: {
            icon: 'Use BasicIcon from @/basic/Icon.vue instead of Bootstrap icon markup.',
            loading: 'Use BasicLoading from @/basic/Loading.vue (or BasicIcon with icon-name="loading" for inline spinners).',
            table: 'Use BasicTable from @/basic/Table.vue instead of raw or Bootstrap tables.',
            modal: 'Use BasicModal from @/basic/Modal.vue instead of raw or Bootstrap modals.',
        },
    },
    create(context) {
        return context.sourceCode.parserServices.defineTemplateBodyVisitor({
            VElement(node) {
                const name = normalizeName(node.rawName)
                const classes = staticClasses(node)
                let messageId
                if (classes.some((name) => name === 'bi' || name.startsWith('bi-'))) messageId = 'icon'
                else if (classes.some((name) => ['spinner-border', 'spinner-grow'].includes(name))) messageId = 'loading'
                else if (['table', 'btable', 'btablelite', 'btablesimple'].includes(name)) messageId = 'table'
                else if (name === 'bmodal' || classes.includes('modal')) messageId = 'modal'
                if (messageId) context.report({ node: node.startTag, messageId })
            },
        })
    },
}
