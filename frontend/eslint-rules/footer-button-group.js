export default {
    meta: {
        type: 'suggestion',
        schema: [],
        messages: {
            missingGroup: 'Wrap grouped modal footer BasicButton actions in an element with class "btn-group".',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode

        const hasClass = (node, className) => {
            const classAttribute = node.startTag.attributes.find(
                (attribute) => !attribute.directive && attribute.key.name === 'class',
            )

            return classAttribute?.value?.value?.split(/\s+/).includes(className)
        }
        const isFooterSlot = (node) =>
            node.rawName === 'template' &&
            node.startTag.attributes.some(
                (attribute) =>
                    attribute.directive &&
                    attribute.key.name.name === 'slot' &&
                    attribute.key.argument?.name === 'footer',
            )
        const isInFooterSlot = (node) => {
            let current = node

            while (current) {
                if (current.type === 'VElement' && isFooterSlot(current)) return true
                current = current.parent
            }

            return false
        }
        const directBasicButtons = (node) =>
            node.children.filter((child) => child.type === 'VElement' && child.rawName === 'BasicButton')

        return sourceCode.parserServices.defineTemplateBodyVisitor({
            VElement(node) {
                if (!isInFooterSlot(node) || hasClass(node, 'btn-group')) return
                if (directBasicButtons(node).length < 2) return

                context.report({ node: node.startTag, messageId: 'missingGroup' })
            },
        })
    },
}
