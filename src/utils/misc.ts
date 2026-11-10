class KeyValue {
    key: string
    valueType: string

    constructor(key: string, value: string) {
        this.key = key
        this.valueType = value === null ? 'null' : typeof value
    }

    toString() {
        return `${this.key}${this.valueType === 'null' ? '?' : ''}: ${this.valueType}`
    }
}

function deepPrint(obj: Object, name = '', recursionLevel = 1) {
    const spacing = '    '.repeat(recursionLevel)
    const altspacing = '    '.repeat(recursionLevel - 1)

    let str = name + '{\n'
    const ar = []

    for (const [key, value] of Object.entries(obj)) {
        if (value !== null && typeof value === 'object') {
            const v = deepPrint(value, key + ': ', recursionLevel + 1)
            ar.push(v)
        } else {
            ar.push(new KeyValue(key, value))
        }
    }

    str += ar.map((x) => spacing + x.toString()).join(',\n') + `\n${altspacing}}`

    return str
}
