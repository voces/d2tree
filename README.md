# d2tree

A [quadtree](https://en.wikipedia.org/wiki/Quadtree) that supports dynamically
adding, removing, and updating items. Splits dynamically, similar to
[k-d trees](https://en.wikipedia.org/wiki/K-d_tree).

# Usage

```ts
import { D2Tree } from "d2tree";

type Unit = {
  id: number;
  x: number;
  y: number;
};

const tree = new D2Tree({ getItemPosition: (unit: Unit) => [unit.x, unit.y] });
const unit1 = { id: 1, x: 0, y: 0 };
tree.add(unit1);
tree.add({ id: 2, x: 10, y: 0 });
tree.add({ id: 3, x: 20, y: 10 });

const query1 = tree.radius(0, 0, 10); // Returns units 1 and 2
const query2 = tree.box(10, 0, 20, 10); // Returns units 2 and 3
const query3 = tree.nearest(0.5, 0.5); // Returns unit 1

tree.remove(unit1);

const query4 = tree.radius(0, 0, 10); // Returns unit 2
```