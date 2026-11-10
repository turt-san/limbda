import { clamp } from '../utils/math'

interface Thresholds {
    left?: number
    right?: number
    top?: number
    bottom?: number
}

export class BindDragAnimation {
    thresholdPercent: number
    movement: boolean
    debug: boolean
    max: number
    animateCircle: boolean
    toFavscore = 1
    visualizer!: HTMLDivElement
    thresholds: Thresholds
    left?
    right?
    top?
    bottom?

    constructor(
        opts?: { moveThreshold?: number; movement?: boolean; debug?: boolean; thresholds?: Thresholds; max?: number; animateCircle?: boolean },
        callbacks?: { left?: () => void; right?: () => void; top?: () => void; bottom?: (score: number, released: boolean) => void },
    ) {
        this.animateCircle = opts?.animateCircle ?? false
        this.thresholdPercent = opts?.moveThreshold ?? 0.02
        this.movement = opts?.movement ?? false
        this.debug = opts?.debug ?? true
        this.max = opts?.max ?? 20

        this.thresholds = {
            left: 1.0,
            right: 1.0,
            top: 1.0,
            bottom: 1.0,
        }

        Object.assign(this.thresholds, opts?.thresholds)

        this.left = callbacks?.left
        this.right = callbacks?.right
        this.top = callbacks?.top
        this.bottom = callbacks?.bottom
    }

    cleanup = () => {
        this.visualizer?.remove()
    }

    bind = (elem: HTMLElement) => {
        const moveThreshold = document.body.clientWidth * (this.thresholdPercent / 100 / 2)
        let x = 0,
            y = 0
        let sx: number, sy: number, bx: number, by: number
        const moveAmp = 1.3
        const calculated = {
            left: -(moveThreshold * this.thresholds.left),
            right: moveThreshold * this.thresholds.right,
            top: -(moveThreshold * this.thresholds.top),
            bottom: moveThreshold * this.thresholds.bottom,
        }

        const lineVisualizer = document.createElement('div')
        lineVisualizer.id = 'line-visualizer'

        let line1
        let line2

        elem.style.touchAction = 'none'
        if (this.debug) {
            this.visualizer = document.createElement('div')
            this.visualizer.id = 'live-mouse-tracker'

            Object.assign(this.visualizer.style, {
                position: 'absolute',
                top: '0px',
                left: '0px',
                width: '40px',
                height: '40px',
                backgroundColor: 'rgba(0, 150, 255, 0.3)',
                border: '2px solid #0096ff',
                // borderRadius: '50%',
                // The transform approach centers the element regardless of its width/height
                // transform: 'translate(-50%, -50%)',
                transform: 'translate(-20px, -20px)',
                // Prevents the tracker from absorbing clicks intended for elements below it
                pointerEvents: 'none',
                // Optimizes performance for smooth rendering
                willChange: 'left, top, width, height, transform',
                // Keep it hidden until the first mouse movement
                display: 'none',
                // Ensures it sits above standard page content
                zIndex: '99999',
            })

            this.visualizer.innerHTML = `
        <svg width="100%" height="100%" preserveAspectRatio="none">
            <path id="line1" d="" style="stroke:red;stroke-width:2;" />
            <path id="line2" d="" style="stroke:red;stroke-width:2;" />
        </svg>`

            line1 = this.visualizer.querySelector('#line1') as SVGPathElement
            line2 = this.visualizer.querySelector('#line2') as SVGPathElement

            document.body.appendChild(this.visualizer)
        }

        let circleId: number

        function countdown() {
            circleId = setTimeout(() => {
                circle.style.strokeDashoffset = '0'
                circleId = setTimeout(() => {}, 500)
            }, 100)
        }

        function moveElem() {
            elem.style.transform = `translate(${x}px, ${y}px)`
        }

        const moveVisualizer = (x: number, y: number) => {
            if (!this.visualizer) return
            const move = moveThreshold
            const leftT = this.thresholds.left * move
            const rightT = this.thresholds.right * move
            const topT = this.thresholds.top * move
            const bottomT = this.thresholds.bottom * move

            line1.setAttribute('d', `M 0 ${topT} L ${leftT + rightT} ${topT}`)
            line2.setAttribute('d', `M ${leftT} ${topT + bottomT} L ${leftT} 0`)

            this.visualizer.style.display = 'block'
            this.visualizer.style.left = `${x}px`
            this.visualizer.style.top = `${y}px`
            this.visualizer.style.width = `${leftT + rightT}px`
            this.visualizer.style.height = `${topT + bottomT}px`
            this.visualizer.style.transform = `translate(-${moveThreshold * this.thresholds.left}px, -${moveThreshold * this.thresholds.top}px)`
        }

        function resetElem() {
            x = 0
            y = 0
            moveElem()
        }

        let special = false

        const end = (e: PointerEvent) => {
            if (elem.hasPointerCapture(e.pointerId)) elem.releasePointerCapture(e.pointerId)
            if (special) {
                special = false
                this.bottom?.(this.toFavscore, true)
            }
            if (this.animateCircle) {
                clearTimeout(circleId)
                circle.style.strokeDashoffset = '100'
            }
            elem.style.cursor = 'grab'
        }

        elem.addEventListener('pointerdown', (e: PointerEvent) => {
            e.preventDefault()
            elem.setPointerCapture(e.pointerId) // keep receiving events even if pointer leaves the element
            sx = e.clientX
            sy = e.clientY
            moveVisualizer(sx, sy)
            bx = x
            by = y
            if (this.animateCircle) {
                countdown()
            }
            elem.style.cursor = 'grabbing'
        })

        const width = document.body.clientWidth

        elem.addEventListener('pointermove', (e: PointerEvent) => {
            if (!elem.hasPointerCapture(e.pointerId)) return
            const cx = e.clientX
            const cy = e.clientY
            const dx = cx - sx
            const dy = cy - sy
            x = bx + dx * moveAmp
            y = by + dy * moveAmp

            let activated = false
            if (!special) {
                switch (true) {
                    case dx < calculated.left:
                        this.left?.()
                        activated = true
                        break
                    case dx > calculated.right:
                        this.right?.()
                        activated = true
                        break
                    case dy < calculated.top:
                        this.top?.()
                        activated = true
                        break
                    case dy > calculated.bottom:
                        special = true
                        break
                }
            } else {
                this.toFavscore = Math.round(((clamp(dx / width / 0.3, -1, 1) + 1) * this.max) / 2)
                this.bottom?.(this.toFavscore, false)
            }

            if (activated) {
                resetElem()
                end(e)
            }

            if (this.movement) {
                moveElem()
            }
        })

        elem.addEventListener('pointerup', end)
        elem.addEventListener('pointercancel', end)

        return () => this.cleanup
    }
}
