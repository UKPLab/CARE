export const normalizeName = (name) => name.replace(/-/g, '').toLowerCase()

export function componentNames(context) {
    const names = new Map()
    for (const node of context.sourceCode.ast.body) {
        if (node.type !== 'ImportDeclaration') continue
        for (const specifier of node.specifiers) {
            if (specifier.type === 'ImportDefaultSpecifier') {
                names.set(normalizeName(specifier.local.name), node.source.value)
            }
        }
    }
    return names
}

export function staticClasses(node) {
    return node.startTag.attributes.find(
        (attribute) => !attribute.directive && attribute.key.name === 'class',
    )?.value?.value?.split(/\s+/) || []
}

export function slotName(node) {
    return node.startTag.attributes.find(
        (attribute) => attribute.directive && attribute.key.name.name === 'slot',
    )?.key.argument?.name
}
