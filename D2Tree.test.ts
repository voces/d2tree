import { expect, it } from "https://deno.land/x/expect@v0.4.0/mod.ts";
import { D2Tree } from "./mod.ts";

type P = [x: number, y: number];

type PlainTree<Item> = { items: Item[]; children?: PlainTree<Item>[] };
const toPlainTree = <Item>(tree: D2Tree<Item>): PlainTree<Item> => {
  const cast = tree as unknown as {
    items: Item[];
    children: D2Tree<Item>[];
  };

  const obj: PlainTree<Item> = { items: cast.items };
  if (cast.children) {
    obj.children = cast.children.map((c) => toPlainTree(c));
  }
  return obj;
};

it("adding, splitting, removing, collapsing", () => {
  const tree = new D2Tree({
    getItemPosition: (p: P) => p,
    density: 3,
  });
  const p1: P = [1, 1];
  tree.add(p1);
  tree.add([1, -1]);
  tree.add([-1, 1]);

  expect(toPlainTree(tree)).toEqual({ items: [[1, 1], [1, -1], [-1, 1]] });

  const p4: P = [-1, -1];
  tree.add(p4);

  expect(toPlainTree(tree)).toEqual({
    items: [],
    children: [
      { items: [[-1, -1]] },
      { items: [[-1, 1]] },
      { items: [[1, -1]] },
      { items: [[1, 1]] },
    ],
  });

  tree.remove(p1);
  tree.remove(p4);

  expect(toPlainTree(tree)).toEqual({ items: [[-1, 1], [1, -1]] });
});

it("updating", () => {
  const tree = new D2Tree({
    getItemPosition: (p: P) => p,
    density: 3,
  });
  const p1: P = [1, 1];
  tree.add(p1);
  tree.add([1, -1]);
  tree.add([-1, 1]);
  tree.add([-1, -1]);
  expect(toPlainTree(tree)).toEqual({
    items: [],
    children: [
      { items: [[-1, -1]] },
      { items: [[-1, 1]] },
      { items: [[1, -1]] },
      { items: [[1, 1]] },
    ],
  });

  // Update but not out of cell
  p1[0] = 0.5;
  tree.update(p1);
  expect(toPlainTree(tree)).toEqual({
    items: [],
    children: [
      { items: [[-1, -1]] },
      { items: [[-1, 1]] },
      { items: [[1, -1]] },
      { items: [[0.5, 1]] },
    ],
  });

  // Update out of cell
  p1[0] = -2;
  tree.update(p1);
  expect(toPlainTree(tree)).toEqual({
    items: [],
    children: [
      { items: [[-1, -1]] },
      { items: [[-1, 1], [-2, 1]] },
      { items: [[1, -1]] },
      { items: [] },
    ],
  });
});

it("iterateBox/box", () => {
  const tree = new D2Tree({ getItemPosition: (p: P) => p, density: 3 });
  tree.add([-1, -1]);
  tree.add([1, -1]);
  tree.add([-1, 1]);
  tree.add([1, 1]);

  expect(tree.box(0, 0, 2, 2)).toEqual([[1, 1]]);
  expect(new Set(tree.iterateBox(-2, 0, 2, 2)))
    .toEqual(new Set([[-1, 1], [1, 1]]));
  expect(new Set(tree.iterateBox(-2, -2, 0, 2)))
    .toEqual(new Set([[-1, -1], [-1, 1]]));
  expect(new Set(tree.iterateBox(-2, -2, 2, 0)))
    .toEqual(new Set([[-1, -1], [1, -1]]));
  expect(new Set(tree.iterateBox(0, -2, 2, 2)))
    .toEqual(new Set([[1, -1], [1, 1]]));
});

it("iterateRadius/radius", () => {
  const tree = new D2Tree({ getItemPosition: (p: P) => p, density: 3 });
  tree.add([-1, -1]);
  tree.add([1, -1]);
  tree.add([-1, 1]);
  tree.add([1, 1]);

  expect(tree.radius(0.5, 0.5, 1)).toEqual([[1, 1]]);
  expect(new Set(tree.iterateRadius(0.5, 0.5, 2)))
    .toEqual(new Set([[-1, 1], [1, -1], [1, 1]]));
});

it("iterateNearest/nearest", () => {
  const tree = new D2Tree({ getItemPosition: (p: P) => p });
  tree.add([1, 1]);
  tree.add([1, -1]);
  tree.add([-1, 1]);
  tree.add([-1, -1]);

  expect(tree.nearest(0.5, 0.25, 3)).toEqual([[1, 1], [1, -1], [-1, 1]]);
  expect(tree.nearest(0.25, 0.5, 3)).toEqual([[1, 1], [-1, 1], [1, -1]]);
  expect(tree.nearest(-1, -1)).toEqual([[-1, -1]]);
});
