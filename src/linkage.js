/* @flow */

"use strict";

import type { Point, Lines } from "./drawing";

const { sin, cos, sqrt } = Math;

export type Linkage = {
  structures: Array<
    | {
        type: "rotary",
        input: { lr: r, x0r: r, y0r: r },
        output: { x1r: r, y1r: r },
      }
    | {
        type: "hinge",
        input: { l0r: r, l1r: r, x0r: r, y0r: r, x1r: r, y1r: r },
        output: { x2r: r, y2r: r },
      }
  >,
  initialVars: { [r]: number },
};

export type r = string;

export const refToPRef = (ref: r): string => ref.substring(1);
export const refsToPRefs = (...refs: Array<r>): Array<string> =>
  refs.map(refToPRef);
export const prefToRefs = (pref: r): [string, string] => [
  `x${pref}`,
  `y${pref}`,
];

function calcHinge(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  l0: number,
  l1: number
): Point {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = sqrt(dx ** 2 + dy ** 2);
  if (l2 > l0 + l1 || l0 > l2 + l1 || l1 > l2 + l0) {
    throw new Error("lengths don't make a triangle");
  }
  const xt = (l2 ** 2 + l0 ** 2 - l1 ** 2) / (2 * l2);
  const yt = sqrt(l0 ** 2 - xt ** 2);
  const cosTheta = dx / l2;
  const sinTheta = dy / l2;
  const x2 = x0 + xt * cosTheta - yt * sinTheta;
  const y2 = y0 + xt * sinTheta + yt * cosTheta;
  return [x2, y2];
}

export function calcLinkage(linkage: Linkage, theta: number): { [r]: number } {
  const vars = { ...linkage.initialVars };
  for (const structure of linkage.structures) {
    switch (structure.type) {
      case "rotary": {
        const {
          input: { x0r, y0r, lr },
          output: { x1r, y1r },
        } = structure;
        const { [x0r]: x0, [y0r]: y0, [lr]: l0 } = vars;
        vars[x1r] = l0 * cos(theta) + x0;
        vars[y1r] = l0 * sin(theta) + y0;
        break;
      }

      case "hinge": {
        const {
          input: { x0r, y0r, x1r, y1r, l0r, l1r },
          output: { x2r, y2r },
        } = structure;
        const {
          [x0r]: x0,
          [y0r]: y0,
          [x1r]: x1,
          [y1r]: y1,
          [l0r]: l0,
          [l1r]: l1,
        } = vars;
        const [x2, y2] = calcHinge(x0, y0, x1, y1, l0, l1);
        vars[x2r] = x2;
        vars[y2r] = y2;
        break;
      }
    }
  }
  return vars;
}

export function calcPath(linkage: Linkage, pr: r, n: number = 125): Lines {
  const path = [];
  const [xr, yr] = prefToRefs(pr);
  for (let i = 0; i < n; i++) {
    const vars = calcLinkage(linkage, (i * Math.PI * 2) / n);
    path.push([vars[xr], vars[yr]]);
  }
  path.push(path[0]);
  return path;
}
