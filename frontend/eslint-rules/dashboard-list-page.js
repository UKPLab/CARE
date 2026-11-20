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
                // ListPage does not forward selection, count, or pagination events.
                const needsTableApi = node.startTag.attributes.some((attribute) => {
                    if (!attribute.directive) {
                        return ['modelvalue', 'count'].includes(normalizeName(attribute.key.name))
                    }
                    const directive = attribute.key.name.name
                    if (directive === 'model') return true
                    if (!['bind', 'on'].includes(directive)) return false
                    const argument = attribute.key.argument
                    // Object bindings and dynamic arguments may use unsupported table APIs.
                    if (!argument || argument.type !== 'VIdentifier') return true
                    const name = normalizeName(argument.name)
                    return directive === 'bind'
                        ? ['modelvalue', 'count'].includes(name)
                        : ['paginationupdate', 'update:modelvalue'].includes(name)
                })
                if (needsTableApi) return
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
