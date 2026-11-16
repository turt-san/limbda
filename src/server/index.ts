import express, { Application } from 'express'
import cors from 'cors'
import mysql, { Pool, PoolConnection, PoolOptions } from 'mysql2/promise'

import { Server } from 'node:http'

const COLOR_MAP: Record<number, string> = {
    2: '\x1b[32m',
    3: '\x1b[36m',
    4: '\x1b[33m',
    5: '\x1b[31m',
} as const

const CREATE_TAGS_TABLE = /* sql */ `
CREATE TABLE IF NOT EXISTS tags (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    count INT UNSIGNED NOT NULL DEFAULT 0,
    type VARCHAR(30) NOT NULL DEFAULT 'unknown',
    tag VARCHAR(50) NOT NULL UNIQUE
)`

interface ConstraintKey {
    name: string
    references: string
    type: string
}

interface SQLJoinTable {
    name: string
    key1: ConstraintKey
    key2: ConstraintKey
}

export const genJoinTableStr = (t: SQLJoinTable) => {
    return `CREATE TABLE IF NOT EXISTS ${t.name} (
        ${t.key1.name} ${t.key1.type} NOT NULL,
        ${t.key2.name} ${t.key2.type} NOT NULL,
        PRIMARY KEY (${t.key1.name}, ${t.key2.name}),
        CONSTRAINT ${t.key1.name}_fkey
            FOREIGN KEY (${t.key1.name})
            REFERENCES ${t.key1.references}
            ON DELETE CASCADE
            ON UPDATE CASCADE,
        CONSTRAINT ${t.key2.name}_fkey
            FOREIGN KEY (${t.key2.name})
            REFERENCES ${t.key2.references}
            ON DELETE CASCADE
            ON UPDATE CASCADE
    )`
}

export interface SQLServerOpts {
    port?: number
    poolOpts?: PoolOptions
    registerRoutes: (app: Application) => void
    startDatabase: (pool: Pool) => void
    includeMiddleware?: boolean
}

export class SQLServer {
    port: number
    app: Application
    #pool?: Pool
    poolOpts?: PoolOptions
    server?: Server
    startDBcallback: ((conn: PoolConnection) => void) | null

    get pool() {
        if (!this.#pool) {
            throw new Error('MySQL pool is not initalized, start the server with .start first')
        }
        return this.#pool
    }

    query: Pool['query'] = (sql, value) => {
        return this.pool.query(sql, value)
    }

    execute: Pool['execute'] = (sql, value) => {
        return this.pool.execute(sql, value)
    }

    constructor(opts?: SQLServerOpts) {
        const includeMiddleware = opts?.includeMiddleware ?? true
        this.app = express()
        this.port = opts?.port ?? 3000
        this.poolOpts = opts?.poolOpts

        this.app.use(cors())
        this.app.use(express.json())

        if (includeMiddleware) {
            this.app.use((req, res, next) => {
                const start = process.hrtime()
                const timestamp = new Date().toISOString()

                // capture details about the incoming request
                const { method, url, ip } = req

                // listen for the finish event (triggered when the response has been sent)
                res.on('finish', () => {
                    // when given an array with [seconds, nanoseconds] hrtime() will calculate the diff automatically
                    const diff = process.hrtime(start)
                    // diff is a two element array, first one holds seconds, the second one holds nanoseconds
                    // we convert seconds to ms with x1000 and nanoseconds to ms with x0.000001
                    const durationInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2)
                    const statusCode = res.statusCode

                    const statusGroup = Math.floor(res.statusCode / 100)
                    const color = COLOR_MAP[statusGroup] ?? '\x1b[32m'

                    console.log(`[${timestamp}] ${method} ${url} - ${color}${statusCode}\x1b[m - ${durationInMs}ms - IP: ${ip}`)
                })

                next()
            })

            this.app.use((err, req, res, next) => {
                console.error('SQL Server Error:', err)
                next(err)
            })
        }

        opts?.registerRoutes(this.app)

        this.startDBcallback = opts?.startDatabase ?? null
    }

    async startDB() {
        const conn = await this.pool.getConnection()

        try {
            this.startDBcallback?.(conn)
            conn.commit()
            console.log('Succesfully created tables in', this.poolOpts?.database)
        } catch (err) {
            conn.rollback()
            console.error('StartDatabase failed with the following error:', err)
        } finally {
            conn.release()
        }
    }

    async start(opts?: { port?: number }) {
        this.port = opts?.port ?? this.port

        this.#pool = mysql.createPool(
            Object.assign(
                {
                    user: 'limbda',
                    host: 'localhost',
                    password: 'stuckinlimbo',
                    database: 'testdatabase',
                    connectionLimit: 10,
                    namedPlaceholders: true,
                },
                this.poolOpts,
            ),
        )

        await this.startDB()

        this.server = this.app.listen(this.port, () => {
            console.log(`Server is running on http://localhost:${this.port}`)
        })

        return this
    }

    debugSql(statement: string, ar: any[]) {
        const f = this.pool.format(statement, ar)
        console.log(f)
    }

    close() {
        console.log('Shutting down server')
        this.server?.close?.()
        this.pool.end()
    }
}

const orderMap: Record<string, string> = {
    score: 'favScore',
    rand: 'RAND()',
    random: 'RAND()',
    ctime: 'ctime',
    btime: 'btime',
    utime: 'utime',
} as const

const metaModeMap: Record<string, string> = {
    score: ' DESC',
    rand: ' ASC',
    random: ' ASC',
    ctime: ' ASC',
    btime: ' ASC',
    utime: ' ASC',
} as const

const modeMap: Record<string, string> = {
    asc: ' ASC',
    desc: ' DESC',
} as const

const specialMap: Record<string | string, string | undefined> = {
    old: "btime < '2025-01-01 00:00:00'",
} as const

const comparisonMap: Record<string, [string, string]> = {
    '>': ['>', '<'],
    '>=': ['>=', '<='],
    '<': ['<', '>'],
    '<=': ['<=', '>='],
}

export interface SQLServerWithTagsOpts extends SQLServerOpts {
    tagsJoinTable: SQLJoinTable
}

export class SQLServerWithTags extends SQLServer {
    tagsJoinTable: SQLJoinTable | null

    constructor(opts?: SQLServerWithTagsOpts) {
        super(opts)
        this.tagsJoinTable = opts?.tagsJoinTable ?? null
        if (this.tagsJoinTable) {
            this.tagsJoinTable.key2 = {
                name: 'tag_id',
                references: 'tags(id)',
                type: 'INT UNSIGNED',
            }
        }
    }

    async startDB() {
        const conn = await this.pool.getConnection()
        try {
            await conn.query(CREATE_TAGS_TABLE)
            this.startDBcallback?.(conn)
            if (this.tagsJoinTable) {
                const joinTable = genJoinTableStr(this.tagsJoinTable)
                await conn.query(joinTable)
            }
            console.log(this.genTagsQueryStr(['penis', 'cock']))
            conn.commit()
            console.log('Succesfully created tables in', this.poolOpts?.database)
        } catch (err) {
            conn.rollback()
            console.error('StartDatabase failed with the following error:', err)
        } finally {
            conn.release()
        }
    }

    genTagsQueryStr(tags: string[] | string, opts?: { tagsAbbr: string; postsAbbr: string }) {
        switch (typeof tags) {
            case 'undefined':
                tags = []
                break
            case 'string':
                tags = tags.split(' ')
                break
        }
        const tagsTableAbbr = opts?.tagsAbbr ?? 't'
        const mainTableAbbr = opts?.postsAbbr ?? 'p'

        const limit = 100

        let order

        let selectJoinFromPosts = ''

        let score = {
            from: 0,
            to: 10,
        }

        let where = ''
        let whereExtra = ''

        const getMeta = (s: string) => {
            let pre = 'ORDER BY '
            let [_, meta, type, mode] = s.match(/([a-z]+):([<>=a-z0-9;]+):?([a-z]+)?/)!
            switch (meta) {
                case 'sort': {
                    pre += orderMap[type] + (modeMap[mode] ?? metaModeMap[type])
                    order = pre
                    break
                }
                case 'score': {
                    const [_, ineq, from, to] = type.match(/([<>=]{1,2})?([0-9]+)(?:;)?([0-9]+)?/)!
                    const [leftIneq, rightIneq] = comparisonMap[ineq] ?? ['>=', '<=']

                    where = `WHERE ${mainTableAbbr}.favScore ${leftIneq} ? AND ${mainTableAbbr}.favScore ${rightIneq} ?`
                    if (from) {
                        score.from = +from
                    }
                    if (to) {
                        score.to = +to
                    }
                    break
                }
                case 'type': {
                    whereExtra += ' AND ' + specialMap[type] ?? specialMap.old
                    break
                }
            }
        }

        const params: any[] = []

        let having = ''

        if (tags.length > 0) {
            const havingConditions: string[] = []
            tags.forEach((x) => {
                if (/^[a-z]+:/.test(x)) {
                    getMeta(x)
                } else {
                    const negative = x.charAt(0) === '-'
                    havingConditions.push(`SUM(${tagsTableAbbr}.tag = ?) ${negative ? '< 1' : '> 0'}`)
                    params.push(x.slice(negative ? 1 : 0))
                }
            })

            if (havingConditions.length > 0) {
                having += `HAVING ` + havingConditions.join(' AND ')
            }
        }

        order ??= 'ORDER BY RAND()'

        const limitStr = `LIMIT ${limit}`

        selectJoinFromPosts += ` ${[where, whereExtra, `GROUP BY ${mainTableAbbr}.id`, having, order, limitStr].join(' ')};`

        return [selectJoinFromPosts, params]
    }

    async updateTags() {}

    async deleteTag() {}

    async createTag() {}

    async insertIntoTags() {}
}
