export class AccelerationAnimator {
    // TODO: rename to Animator
    accelSpeed: number
    deaccelSpeed: number
    maxVelocity: number
    boostAmount: number
    callback: Function

    x = 0
    v = 0
    boost = 0
    last = performance.now()
    active = true

    constructor(
        container: HTMLElement,
        callback: (x: number) => void,
        opts?: {
            accelSpeed?: number
            deaccelSpeed?: number
            maxVelocity?: number
            boostAmount?: number
        }
    ) {
        this.callback = callback ?? function () {}
        this.accelSpeed = opts?.accelSpeed ?? 600
        this.deaccelSpeed = opts?.deaccelSpeed ?? 1000
        this.maxVelocity = opts?.maxVelocity ?? 400
        this.boostAmount = opts?.boostAmount ?? 1.3

        container.addEventListener('pointerenter', () => {
            this.active = true
            if (this.v <= 0 && !this.rafId) {
                this.last = performance.now()
                this.rafId = requestAnimationFrame(this.tick)
            } else {
            }
        })

        container.addEventListener('pointerleave', () => {
            this.active = false
        })

        container.addEventListener('pointerdown', () => {
            this.boost = 1.2
        })
    }
    rafId: number | null = null

    k(n: number) {
        return 1 + (n - 1) * this.boost
    }

    tick = (time: DOMHighResTimeStamp) => {
        const dt = (time - this.last) / 1000
        this.last = time

        const accel = this.accelSpeed * this.k(3)
        const max = this.maxVelocity * this.k(3)

        if (this.active) {
            this.v = Math.min(this.v + accel * dt, max)
        } else {
            this.v = Math.max(this.v + -this.deaccelSpeed * dt, 0)
        }
        if (this.boost > 0) {
            this.boost = Math.max(this.boost - dt, 0)
        }
        this.x += this.v * dt

        if (this.v <= 0 && !this.active) {
            this.rafId = null
        } else {
            this.rafId = requestAnimationFrame(this.tick)
        }
        this.callback(this.x)
    }
}

const tmp = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
    <pattern id="arrows-pattern" x="0" y="0" width="50" height="100" patternUnits="userSpaceOnUse">
        <path id="line" d="M 0 0 h 10 L 50 50 L 10 100 h -10 L 40 50 Z"></path>
    </pattern>
    <rect width="100%" height="100%" x="0" y="0" fill="url(#arrows-pattern)" />
</svg>`

export class ArrowSVG extends HTMLElement {
    connectedCallback() {
        const root = this.attachShadow({ mode: 'open' }) // optional: style encapsulation
        root.innerHTML = tmp
        const pattern = root.querySelector('#arrows-pattern')
        const toParent = this.getAttribute('parent') === 'true'
        new AccelerationAnimator(toParent ? this.parentElement : this, (x) => {
            pattern.setAttribute('x', x.toString())
        })
    }
}
