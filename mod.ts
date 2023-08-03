export class D2Tree<Item> {
  constructor(
    {
      getItemPosition,
      density = 10,
      thrash = 1.25,
      _itemToTreeMap,
      _parent,
      _max,
      _min,
    }: {
      getItemPosition: (item: Item) => [x: number, y: number];
      density?: number;
      thrash?: number;
      _itemToTreeMap?: Map<Item, D2Tree<Item>>;
      _parent?: D2Tree<Item>;
      _max?: [x: number, y: number];
      _min?: [x: number, y: number];
    },
  ) {
    if (density <= 1) throw new Error("density must be 2 or more");
    this.getItemPosition = getItemPosition;
    this.density = density;
    this.thrash = thrash;
    this.itemToTreeMap = _itemToTreeMap ?? new Map();
    this.parent = _parent;
    this.max = _max ?? [Infinity, Infinity];
    this.min = _min ?? [-Infinity, -Infinity];
  }

  /**
   * Add an item to the tree.
   */
  add(item: Item): void {
    const cell = this.drill(...this.getItemPosition(item));

    if (cell.shouldSplit) {
      cell.split();
      cell.add(item);
      return;
    }

    cell.items.push(item);
    this.itemToTreeMap.set(item, cell);
  }

  /**
   * Remove an item from the tree.
   */
  remove(item: Item): void {
    const container = this.itemToTreeMap.get(item);
    if (!container) return;
    const index = container.items.indexOf(item);
    if (index === -1) return;
    container.items.splice(index, 1);
    if (
      container.parent?.children?.every((c) => !c.children) &&
      container.parent.children.reduce((sum, c) => sum + c.items.length, 0) *
            this.thrash < this.density
    ) container.parent.collapse();
  }

  /**
   * Update an item's internal location in the tree. Should be called whenever
   * the item's position changes.
   */
  update(item: Item): void {
    const container = this.itemToTreeMap.get(item);
    if (!container) return this.add(item);
    const [x, y] = this.getItemPosition(item);
    if (
      x >= container.min[0] &&
      x < container.max[0] &&
      y >= container.min[1] &&
      y < container.max[1]
    ) return;
    container.remove(item);
    this.add(item);
  }

  /**
   * Iterate through all items in the tree in no particular order.
   */
  *[Symbol.iterator]() {
    const remaining: D2Tree<Item>[] = [this];
    while (remaining.length) {
      const current = remaining.pop()!;
      if (current.children) remaining.push(...current.children);
      else {
        for (let i = 0; i < current.items.length; i++) yield current.items[i];
      }
    }
  }

  /**
   * Iterate through items in the tree that fit inside the provided rectangle.
   * Items are not in any particular order.
   */
  *iterateBox(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): Generator<Item> {
    // Start off the cells with the superstructure
    const cells: D2Tree<Item>[] = [this];
    let cell;

    // Loop while non-empty
    // deno-lint-ignore no-cond-assign
    while (cell = cells.pop()) {
      // We have children; add them to cells and try again
      if (cell.children) {
        for (let i = 0; i < cell.children.length; i++) {
          // https://www.geeksforgeeks.org/find-two-rectangles-overlap/
          if (
            // If one rectangle is on the left side of other
            minX <= cell.children[i].max[0] &&
            cell.children[i].min[0] <= maxX &&
            // If one rectangle is above other
            maxY >= cell.children[i].min[1] &&
            cell.children[i].max[1] >= minY
          ) {
            cells.push(cell.children[i]);
          }
        }

        // No children; return items
      } else {
        for (let i = 0; i < cell.items.length; i++) {
          const [x, y] = this.getItemPosition(cell.items[i]);
          if (minX <= x && minY <= y && maxX >= x && maxY >= y) {
            yield cell.items[i];
          }
        }
      }
    }
  }

  /**
   * List all items in the tree that fit inside the provided rectangle. Items
   * are not in any particular order.
   */
  box(minX: number, minY: number, maxX: number, maxY: number): Item[] {
    return Array.from(this.iterateBox(minX, minY, maxX, maxY));
  }

  /**
   * Iterate through items in the tree that fat inside the provided circle.
   * Items are not in any particular order.
   */
  *iterateRadius(x: number, y: number, radius: number): Generator<Item> {
    const radiusSquared = radius ** 2;
    const generator = this.iterateBox(
      x - radius,
      y - radius,
      x + radius,
      y + radius,
    );
    for (const item of generator) {
      const [itemX, itemY] = this.getItemPosition(item);
      if ((x - itemX) ** 2 + (y - itemY) ** 2 <= radiusSquared) yield item;
    }
  }

  /**
   * List all items in the tree that fit inside the provided circle. Items are
   * not in any particular order.
   */
  radius(x: number, y: number, radius: number): Item[] {
    return Array.from(this.iterateRadius(x, y, radius));
  }

  /**
   * Iterate through all items in the tree order by distance to the provided
   * point.
   */
  *iterateNearest(x: number, y: number): Generator<Item> {
    const closed = new Set<D2Tree<Item>>();
    let cur: D2Tree<Item> | undefined = this.drill(x, y);
    cur = cur.parent?.parent ?? cur.parent ?? cur;
    const memory = new Map<Item, number>();
    const distanceSquared = (item: Item) => {
      const memoized = memory.get(item);
      if (typeof memoized === "number") return memoized;
      const [itemX, itemY] = this.getItemPosition(item);
      const value = (itemX - x) ** 2 + (itemY - y) ** 2;
      memory.set(item, value);
      return value;
    };
    while (cur) {
      const items = Array.from(cur.iterateTrees())
        // If we were smarter we could skip the filtering...
        .filter((tree) => {
          if (closed.has(tree)) return false;
          closed.add(tree);
          return true;
        })
        .flatMap((tree) => tree.items)
        .sort((a, b) => distanceSquared(a) - distanceSquared(b));

      for (let i = 0; i < items.length; i++) yield items[i];

      cur = cur.parent;
    }
  }

  /**
   * List all items in the tree order by distance to the provided point. Provide
   * `count` to list only the `count` nearest items.
   */
  nearest(
    x: number,
    y: number,
    count = 1,
  ): Item[] {
    const arr: Item[] = [];
    const generator = this.iterateNearest(x, y);
    while (arr.length < count) {
      const item = generator.next().value;
      if (item) arr.push(item);
      else return arr;
    }
    return arr;
  }

  readonly density: number;
  readonly thrash: number;
  private readonly parent?: D2Tree<Item>;
  private readonly getItemPosition: (item: Item) => [x: number, y: number];
  private readonly items: Item[] = [];
  private children?: D2Tree<Item>[];
  private readonly itemToTreeMap: Map<Item, D2Tree<Item>>;
  private readonly max: [x: number, y: number];
  private readonly min: [x: number, y: number];
  protected center: [x: number, y: number] = [0, 0];

  private get shouldSplit() {
    if (this.items.length < this.density) return false;
    const [x, y] = this.getItemPosition(this.items[0]);
    for (let i = 1; i < this.items.length; i++) {
      const [itemX, itemY] = this.getItemPosition(this.items[i]);
      if (x !== itemX || y !== itemY) return true;
    }
    return false;
  }

  private drill(x: number, y: number): D2Tree<Item> {
    if (!this.children) return this;
    if (x < this.center[0]) {
      if (y < this.center[1]) return this.children[0].drill(x, y);
      else return this.children[1].drill(x, y);
    } else if (y < this.center[1]) return this.children[2].drill(x, y);
    else return this.children[3].drill(x, y);
  }

  private split() {
    let x = 0;
    let y = 0;
    for (let i = 0; i < this.items.length; i++) {
      const [itemX, itemY] = this.getItemPosition(this.items[i]);
      x += itemX;
      y += itemY;
    }
    x /= this.items.length;
    y /= this.items.length;

    this.center = [x, y];

    const props = {
      density: this.density,
      thrash: this.thrash,
      getItemPosition: this.getItemPosition,
      _itemToTreeMap: this.itemToTreeMap,
      _parent: this,
    };
    this.children = [
      new D2Tree({ ...props, _min: this.min, _max: [x, y] }),
      new D2Tree({ ...props, _min: [this.min[0], y], _max: [x, this.max[1]] }),
      new D2Tree({ ...props, _min: [x, this.min[1]], _max: [this.max[0], y] }),
      new D2Tree({ ...props, _min: [x, y], _max: this.max }),
    ];

    for (let i = 0; i < this.items.length; i++) this.add(this.items[i]);
    this.items.splice(0);
  }

  private collapse() {
    this.items.push(...this.children?.flatMap((c) => c.items) ?? []);
    for (let i = 0; i < this.items.length; i++) {
      this.itemToTreeMap.set(this.items[i], this);
    }
    this.children = undefined;
  }

  private *iterateTrees(leaves = true) {
    const remaining: D2Tree<Item>[] = [this];
    while (remaining.length) {
      const current = remaining.pop()!;
      if (current.children) {
        if (!leaves) yield current;
        remaining.push(...current.children);
      } else yield current;
    }
  }
}
