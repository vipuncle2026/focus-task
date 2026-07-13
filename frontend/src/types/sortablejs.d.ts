declare module 'sortablejs' {
  namespace Sortable {
    type SortableEvent = {
      item: HTMLElement
      from: HTMLElement
      to: HTMLElement
      oldIndex: number | undefined
      newIndex: number | undefined
      clone: HTMLElement | undefined
      pullMode: string | undefined
    }
    type SortableOptions = {
      group?: string | { name?: string; pull?: boolean | string | Function; put?: boolean | string | Function | Function[]; revertClone?: boolean }
      sort?: boolean
      delay?: number
      delayOnTouchOnly?: boolean
      touchStartThreshold?: number
      disabled?: boolean
      animation?: number
      easing?: string | Function
      handle?: string | Function
      filter?: string | Function
      preventOnFilter?: boolean
      draggable?: string
      ghostClass?: string
      chosenClass?: string
      dragClass?: string
      forceFallback?: boolean
      fallbackClass?: string
      fallbackOnBody?: boolean
      fallbackTolerance?: number
      fallbackOffset?: { x: number; y: number }
      emptyInsertThreshold?: number
      swapThreshold?: number
      invertSwap?: boolean
      invertedSwapThreshold?: number
      direction?: string | Function
      onStart?: (evt: SortableEvent) => void
      onEnd?: (evt: SortableEvent) => void
      onAdd?: (evt: SortableEvent) => void
      onUpdate?: (evt: SortableEvent) => void
      onSort?: (evt: SortableEvent) => void
      onRemove?: (evt: SortableEvent) => void
      onFilter?: (evt: SortableEvent) => void
      onMove?: (evt: SortableEvent, originalEvent: Event) => boolean | -1 | void
      onClone?: (evt: SortableEvent) => void
      onChange?: (evt: SortableEvent) => void
    }
  }

  class Sortable {
    constructor(el: HTMLElement, options?: Sortable.SortableOptions)
    static create(el: HTMLElement, options?: Sortable.SortableOptions): Sortable
    destroy(): void
    option(key: string, value: any): any
    sort(order: string[], useAnimation?: boolean): void
    toArray(): string[]
    closest(el: HTMLElement, selector: string): HTMLElement | null
    el: HTMLElement
    options: Sortable.SortableOptions
  }

  export default Sortable
}
