import express, { Application } from 'express'
import cors from 'cors'
import mysql, { Pool, PoolOptions } from 'mysql2/promise'

import { Server } from 'node:http'

const COLOR_MAP: Record<number, string> = {
    2: '\x1b[32m',
    3: '\x1b[36m',
    4: '\x1b[33m',
    5: '\x1b[31m',
} as const

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
    #poolOpts?: PoolOptions
    server?: Server
    startDB: (pool: Pool) => void

    get pool() {
        if (!this.#pool) {
            throw new Error('Server is not running, cannot use mysql pool')
        }
        return this.#pool
    }

    query: Pool['query'] = (sql, value) => {
        return this.pool.query(sql, value)
    }

    execute: Pool['execute'] = (sql, value) => {
        return this.pool.execute(sql, value)
    }

    constructor(opts: SQLServerOpts) {
        const includeMiddleware = opts?.includeMiddleware ?? true
        this.app = express()
        this.port = opts?.port ?? 3000
        this.#poolOpts = opts.poolOpts

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

        opts.registerRoutes(this.app)

        this.startDB = opts.startDatabase
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
                this.#poolOpts,
            ),
        )

        this.startDB(this.#pool)

        console.log('Succesfully opened database')

        this.server = this.app.listen(this.port, () => {
            console.log(`Server is running on http://localhost:${this.port}`)
        })

        return this
    }

    close() {
        console.log('Shutting down server')
        this.server?.close?.()
        this.pool.end()
    }
}
