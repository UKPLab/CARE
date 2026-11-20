export default {
    meta: {
        type: 'suggestion',
        schema: [],
        messages: {
            helper: 'Use dashboardRowAction() for common actions or dashboardRowButton() for custom icons, imported from @/basic/dashboard/actions.js.',
        },
    },
    create(context) {
        const helpers = new Set()
        for (const node of context.sourceCode.ast.body) {
            if (node.type !== 'ImportDeclaration' || !node.source.value.endsWith('/basic/dashboard/actions.js')) continue
            for (const specifier of node.specifiers) {
                if (['dashboardRowAction', 'dashboardRowButton'].includes(specifier.imported?.name)) {
                    helpers.add(specifier.local.name)
                }
            }
        }
        return {
            ObjectExpression(node) {
                const keys = node.properties
                    .filter((property) => property.type === 'Property' && !property.computed)
                    .map((property) => property.key.name || property.key.value)
                if (!keys.includes('action') || !keys.includes('icon')) return
                let parent = node.parent
                while (parent && !['Property', 'ReturnStatement', 'VariableDeclarator', 'AssignmentExpression'].includes(parent.type)) {
                    if (parent.type === 'CallExpression' && helpers.has(parent.callee.name)) return
                    parent = parent.parent
                }
                // Row fields (for example an icon-selector cell) are not row buttons.
                if (parent?.type === 'AssignmentExpression' && parent.left.type === 'MemberExpression') {
                    const field = parent.left.computed ? parent.left.property.value : parent.left.property.name
                    if (field !== 'buttons') return
                }
                context.report({ node, messageId: 'helper' })
            },
        }
    },
}
