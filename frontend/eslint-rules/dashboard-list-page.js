import { componentNames, normalizeName } from './template-utils.js'

export default {
    meta: {
        type: 'suggestion',
        schema: [],
        messages: {
            listPage: 'Use DashboardListPage from @/basic/dashboard/ListPage.vue for a Card + BasicTable list. Use #headerActions and #afterTable for page content.',
        },
    },
    create(context) {
        const names = componentNames(context)
        return context.sourceCode.parserServices.defineTemplateBodyVisitor({
            VElement(node) {
                if (!names.get(normalizeName(node.rawName))?.endsWith('/basic/Table.vue')) return
                let parent = node.parent
                while (parent?.type === 'VElement') {
                    // Tables inside modals are not dashboard list pages.
                    const path = names.get(normalizeName(parent.rawName)) || ''
                    if (/Modal\.vue$|\/modal\//.test(path)) return
                    if (path.endsWith('/basic/dashboard/card/Card.vue')) {
                        context.report({ node: node.startTag, messageId: 'listPage' })
                        return
                    }
                    parent = parent.parent
                }
            },
        })
    },
}
