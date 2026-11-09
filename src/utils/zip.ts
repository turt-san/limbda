export default function* zip(...iters: any[]) {
    let iterators = iters.map((it) => it[Symbol.iterator]())
    let cleanup = false
    while (true) {
        const result = iterators.map((it) => it.next())
        const data: any[] = []
        result.forEach((r, i) => {
            if (r.done) {
                cleanup = true
                iterators[i] = undefined
            } else {
                data.push(r.value)
            }
        })
        if (cleanup) {
            iterators = iterators.filter((v) => v !== undefined)
        }
        if (iterators.length < 1) {
            return
        }
        yield data
    }
}

export const zipToArray = (...iters: any[]) => {
    return zip(...iters)
        .toArray()
        .flat()
}
