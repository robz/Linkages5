/* @flow */

"use strict";

import type { Point, Lines } from "./drawing";
import type { r, Linkage } from "./linkage";

import { calcPath, prefToRefs, refToPRef, refsToPRefs } from "./linkage";
import { euclid } from "./geometry";

export type PointMap = {
  [r]: Array<
    | { type: "ground" }
    | { type: "joint", pr: r, lr: r }
    | { type: "actuator", pr: r, lr: r }
  >,
};

function tryAddGround(
  initialVars: { [r]: number },
  m: PointMap,
  xr: r,
  p0r: r,
  p1r: r,
  lr: r
) {
  m[p0r].push(
    initialVars[xr] != null
      ? { type: "ground" }
      : { type: "joint", pr: p1r, lr }
  );
}

// map points to connections (grounds, joints, actuators)
export function buildPointMap({ structures, initialVars }: Linkage): PointMap {
  const m: PointMap = {};
  Object.keys(initialVars).forEach((ref) => {
    if (ref.startsWith("x")) {
      m[refToPRef(ref)] = [];
    }
  });
  for (const structure of structures) {
    switch (structure.type) {
      case "rotary": {
        const {
          input: { x0r, lr },
          output: { x1r },
        } = structure;
        const [p0r, p1r] = refsToPRefs(x0r, x1r);
        tryAddGround(initialVars, m, x0r, p0r, p1r, lr);
        m[p1r] = m[p1r] || [];
        m[p1r].push({ type: "actuator", pr: p0r, lr });
        break;
      }

      case "hinge": {
        const {
          input: { x0r, x1r, l0r, l1r },
          output: { x2r },
        } = structure;
        const [p0r, p1r, p2r] = refsToPRefs(x0r, x1r, x2r);
        tryAddGround(initialVars, m, x0r, p0r, p2r, l0r);
        tryAddGround(initialVars, m, x1r, p1r, p2r, l1r);
        m[p2r] = m[p2r] || [];
        m[p2r].push(
          { type: "joint", pr: p0r, lr: l0r },
          { type: "joint", pr: p1r, lr: l1r }
        );
        break;
      }
    }
  }
  Object.keys(m).forEach((pr) => {
    const actuators = m[pr].filter((p) => p.type === "actuator");
    if (actuators.length > 0) {
      // moving actuators should only change the lengths of the actuator,
      // not the lengths of the links attached to it
      m[pr] = actuators;
    }
  });
  return m;
}

export function getNearestPoint(
  p0: Point,
  keys: Array<[r, r]>,
  vars: { [r]: number },
  threshold: number
): ?[r, r] {
  for (const [xr, yr] of keys) {
    if (euclid(p0, [vars[xr], vars[yr]]) < threshold) {
      return [xr, yr];
    }
  }
}

export function movePoint(
  pointKey: [r, r],
  oldPoint: Point,
  newPoint: Point,
  pointMap: PointMap,
  linkage: Linkage,
  theta: number,
  vars: { [r]: number },
  tracePr: r
): ?[
  {[r]: number},
  number,
  Lines,
] {
  const pr = refToPRef(pointKey[0]);
  const oldInitialVars = { ...linkage.initialVars };
  for (const connection of pointMap[pr]) {
    switch (connection.type) {
      case "ground":
        linkage.initialVars[pointKey[0]] = newPoint[0];
        linkage.initialVars[pointKey[1]] = newPoint[1];
        break;

      case "actuator":
      case "joint":
        const { lr, pr: pr0 } = connection;
        const [x0r, y0r] = prefToRefs(pr0);
        const origin = [vars[x0r], vars[y0r]];
        linkage.initialVars[lr] = euclid(origin, newPoint);
        if (connection.type === "actuator") {
          theta = Math.atan2(newPoint[1] - origin[1], newPoint[0] - origin[0]);
        }
        break;
    }
  }
  try {
    const path = calcPath(linkage, tracePr);
    return [linkage.initialVars, theta, path];
  } catch {
    return null;
  } finally {
    linkage.initialVars = oldInitialVars;
  }
}
