export default class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize
    this.cells = new Map()
  }

  cellKey({ x, y }) {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`
  }

  add(value) {
    const key = this.cellKey(value.pos)
    let cell = this.cells.get(key)
    if (!cell) {
      cell = new Set()
      this.cells.set(key, cell)
    }
    cell.add(value)
  }

  remove(value) {
    const key = this.cellKey(value.pos)
    const cell = this.cells.get(key)
    cell.delete(value)
    if (!cell.size) this.cells.delete(key)
  }

  *nearby({ x, y }, radius) {
    const size = this.cellSize
    const lastColumn = Math.floor((x + radius) / size)
    const lastRow = Math.floor((y + radius) / size)
    for (let column = Math.floor((x - radius) / size); column <= lastColumn; column++) {
      for (let row = Math.floor((y - radius) / size); row <= lastRow; row++) {
        const cell = this.cells.get(`${column},${row}`)
        if (cell) yield* cell
      }
    }
  }
}
