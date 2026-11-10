const DOMAIN = 'etilbudsavis'
const PLATFORMS = ['sensor']

export interface Offer {
    id: string
    ern: string
    heading: string
    description: string
    catalog_page: number
    catalog_view_id?: null
    pricing: {
        price: number
        pre_price?: null
        currency: string
    }
    quantity: {
        unit: {
            symbol: string
            si: {
                symbol: string
                factor: number
            }
        }
        size: {
            from: number
            to: number
        }
        pieces: {
            from: number
            to: number
            min?: null
            max: number
        }
    }
    images: {
        thumb: string
        view: string
        zoom: string
    }
    links: {
        webshop?: null
    }
    run_from: string
    run_till: string
    display_run_till: boolean
    publish: string
    dealer_url: string
    dealer_id: string
    dealer: {
        id: string
        ern: string
        graph_id?: null
        name: string
        website: string
        description: string
        description_markdown: string
        logo: string
        color: string
        pageflip: {
            logo: string
            color: string
        }
        category_ids: {}
        country: {
            id: string
            unsubscribe_print_url?: null
        }
        markets: {
            0: {
                slug: string
                country_code: string
            }
        }
        favorite_count: number
        facebook_page_id?: null
        youtube_user_id?: null
        twitter_handle?: null
    }
    store_url?: null
    store_id?: null
    catalog_url: string
    catalog_id: string
    branding: {
        name: string
        website: string
        description: string
        color: string
        logo: string
        pageflip: {
            color: string
            logo: string
        }
    }
    category_ids: {}
}

const API_BASE = 'https://api.etilbudsavis.dk/v2/offers/search'
const API_CATALOGS = 'https://api.etilbudsavis.dk/v2/catalogs'
const API_LOCALE = 'da_DK'
const API_AV = '0.3.0'
const DEFAULT_RADIUS = 25000
const DEFAULT_SCAN_INTERVAL = 21600 // 6 hours
const DEFAULT_LIMIT = 100 // API maximum per request
const CATALOG_MAX_PAGES = 5
// Catalogs are fetched nationwide so stores far from home (border shops) work
const CATALOG_RADIUS = 500000
// "paged" = printed-style catalogs, "incito" = digital catalogs (e.g. Biltema, BAUHAUS)
const CATALOG_TYPES = ['paged', 'incito']

const CONF_SEARCH_TERMS = 'search_terms'
const CONF_RADIUS = 'radius'
const CONF_STORES = 'stores'
const CONF_CANS_ONLY = 'cans_only'
const CONF_PRICE_PER_LITER = 'price_per_liter'
const CONF_PRICE_PER_KG = 'price_per_kg'
const CONF_MAX_OFFERS = 'max_offers'
const CONF_CATALOGS = 'catalogs'
const CONF_FEATURES = 'features'
const FEATURE_SEARCH = 'search'
const FEATURE_CATALOGS = 'catalogs'

const ALL_STORES = ['Bilka', 'Coop 365', 'Fakta', 'Føtex', 'Kvickly', 'Lidl', 'Meny', 'Netto', 'Rema1000', 'Spar', 'SuperBrugsen']

// Store names as users type them, mapped to the API's branding name
const STORE_ALIASES = {
    coop365: '365discount',
    fakta: '365discount', // Fakta was renamed Coop 365
}

const lat = 55.667856
const lon = 12.599712
const radius = 5000

const paramsDefault = {
    r_lat: lat,
    r_lng: lon,
    r_radius: radius,
    r_locale: API_LOCALE,
    api_av: API_AV,
    offset: 0,
    limit: DEFAULT_LIMIT,
}

export async function fetchWithSearch(query: string): Promise<Offer[]> {
    query ??= 'cola'
    const params = new URLSearchParams(paramsDefault)
    params.set('query', query)
    const url = new URL(API_BASE)
    url.search = '?' + params
    const res = await fetch(url)
    const data = res.json()
    return data
}

interface EtilbudsavisParamOptions {
    r_lat?: number
    r_lng?: number
    r_radius?: number
    r_locale?: string
    api_av?: string
    offset?: number
    limit?: number
}

export class EtilbudsavisClient {
    apiParams: {
        r_lat: number
        r_lng: number
        r_radius: number
        r_locale: string
        api_av: string
        offset: number
        limit: number
    }

    constructor(apiParams?: EtilbudsavisParamOptions) {
        this.apiParams = {
            r_lat: apiParams?.r_lat ?? lat,
            r_lng: apiParams?.r_lng ?? lon,
            r_radius: apiParams?.r_radius ?? radius,
            r_locale: apiParams?.r_locale ?? API_LOCALE,
            api_av: apiParams?.api_av ?? API_AV,
            offset: apiParams?.offset ?? 0,
            limit: apiParams?.limit ?? DEFAULT_LIMIT,
        }
    }

    async fetchQuery(query?: string) {
        query ??= 'cola'
        const params = new URLSearchParams(this.apiParams)
        params.set('query', query)
        const url = new URL(API_BASE)
        url.search = '?' + params
        const res = await fetch(url)
        const data = res.json()
        return data
    }
}
