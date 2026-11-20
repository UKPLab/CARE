import { componentNames, normalizeName, slotName, staticClasses } from './template-utils.js'

export default {
    meta: {
        type: 'suggestion',
        schema: [],
        messages: {
            missingGroup: 'Wrap modal footer BasicButton actions in an element with class "btn-group", including actions inside nested wrappers.',
        },
    },
    create(context) {
        const names = componentNames(context)
        return context.sourceCode.parserServices.defineTemplateBodyVisitor({
            VElement(node) {
                const name = normalizeName(node.rawName)
                if (name !== 'basicbutton' && !names.get(name)?.endsWith('/basic/Button.vue')) return
                let parent = node.parent
                let grouped = false
                while (parent?.type === 'VElement') {
                    if (staticClasses(parent).includes('btn-group')) grouped = true
                    if (['footer', 'success-footer'].includes(slotName(parent))) {
                        const owner = parent.parent
                        const ownerName = normalizeName(owner?.rawName || '')
                        const path = names.get(ownerName) || ''
                        if (!grouped && (/Modal\.vue$|\/modal\/|\/Coordinator\.vue$/.test(path) ||
                            ['basicmodal', 'basiccoordinator', 'steppermodal'].includes(ownerName))) {
                            context.report({ node: node.startTag, messageId: 'missingGroup' })
                        }
                        return
                    }
                    parent = parent.parent
                }
            },
        })
    },
}
