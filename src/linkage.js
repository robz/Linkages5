/* @flow */

'use strict';

import type {Point, Lines} from './drawing';

import {euclid} from './geometry';

const {sin, cos, sqrt} = Math;

export type r = string;

type RotaryStructure = {
  type: 'rotary',
  input: {lr: r, x0r: r, y0r: r},
  output: {x1r: r, y1r: r},
};

// Linkage spec that is exported/imported
export type LinkageExternal = {
  structures: Array<
    | RotaryStructure
    | {
        type: 'hinge',
        input: {l0r: r, l1r: r, x0r: r, y0r: r, x1r: r, y1r: r},
        output: {x2r: r, y2r: r},
      }
  >,
  initialVars: {[r]: number},
};

// Internal linkage spec, which reparameterizes hinges
export type LinkageInternal = {
  structures: Array<
    | {
        type: 'rotary',
        input: {lr: r, x0r: r, y0r: r},
        output: {x1r: r, y1r: r},
      }
    | {
        type: 'hinge',
        input: {xtr: r, ytr: r, l2tr: r, x0r: r, y0r: r, x1r: r, y1r: r},
        output: {x2r: r, y2r: r},
      }
  >,
  initialVars: {[r]: number},
};

export const refToPRef = (ref: r): string => ref.substring(1);
export const refsToPRefs = (...refs: Array<r>): Array<string> =>
  refs.map(refToPRef);
export const prefToRefs = (pref: string): [r, r] => [`x${pref}`, `y${pref}`];

function getMaxN(varNames: Array<r>, type: string): number {
  const ns = varNames
    .filter((v) => v[0] === type)
    .map((v) => parseInt(v.substring(1)));
  return Math.max(-1, ...ns);
}

export function makeRefCounters(
  varNames: Array<r>
): {getXR: () => r, getYR: () => r, getLR: () => r} {
  let ln = 1 + getMaxN(varNames, 'l');
  let xn = 1 + getMaxN(varNames, 'x');
  let yn = 1 + getMaxN(varNames, 'y');
  return {
    getXR: () => `x${xn++}`,
    getYR: () => `y${yn++}`,
    getLR: () => `l${ln++}`,
  };
}

function calcHinge(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  l0: number,
  l1: number
): {p2: Point, xt: number, yt: number, l2: number} {
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
  return {p2: [x2, y2], xt, yt, l2};
}

export function calcHingeFromPoints(
  [x0, y0]: Point,
  [x1, y1]: Point,
  [x2, y2]: Point
): {
  xt: number,
  yt: number,
  l2: number,
} {
  const l2 = euclid([x0, y0], [x1, y1]);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const cosTheta = dx / l2;
  const sinTheta = -dy / l2;
  const xt = x2 - x0;
  const yt = y2 - y0;
  return {
    xt: xt * cosTheta - yt * sinTheta,
    yt: xt * sinTheta + yt * cosTheta,
    l2,
  };
}

function calcHingeInternal(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  xt: number,
  yt: number,
  l2t: number
): {p2: Point, l0: number, l1: number} {
  const l0 = sqrt(xt ** 2 + yt ** 2);
  const l1 = sqrt((l2t - xt) ** 2 + yt ** 2);
  const ytSign = yt > 0 ? 1 : -1;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = sqrt(dx ** 2 + dy ** 2);
  if (l2 > l0 + l1 || l0 > l2 + l1 || l1 > l2 + l0) {
    throw new Error("lengths don't make a triangle");
  }
  xt = (l2 ** 2 + l0 ** 2 - l1 ** 2) / (2 * l2);
  yt = ytSign * sqrt(l0 ** 2 - xt ** 2);
  const cosTheta = dx / l2;
  const sinTheta = dy / l2;
  const x2 = x0 + xt * cosTheta - yt * sinTheta;
  const y2 = y0 + xt * sinTheta + yt * cosTheta;
  return {p2: [x2, y2], l0, l1};
}

function getVarNamesExternal(linkage: LinkageExternal): Array<r> {
  const set = new Set();
  for (const structure of linkage.structures) {
    switch (structure.type) {
      case 'rotary': {
        let {
          input: {x0r, y0r, lr},
          output: {x1r, y1r},
        } = structure;
        [x0r, y0r, lr, x1r, y1r].forEach((r) => set.add(r));
        break;
      }
      case 'hinge': {
        let {
          input: {x0r, y0r, x1r, y1r, l0r, l1r},
          output: {x2r, y2r},
        } = structure;
        [x0r, y0r, x1r, y1r, l0r, l1r, x2r, y2r].forEach((r) => set.add(r));
        break;
      }
    }
  }
  return Array.from(set);
}

function getVarNamesInternal(linkage: LinkageInternal): Array<r> {
  const set = new Set();
  for (const structure of linkage.structures) {
    switch (structure.type) {
      case 'rotary': {
        let {
          input: {x0r, y0r, lr},
          output: {x1r, y1r},
        } = structure;
        [x0r, y0r, lr, x1r, y1r].forEach((r) => set.add(r));
        break;
      }
      case 'hinge': {
        let {
          input: {x0r, y0r, x1r, y1r, xtr, ytr, l2tr},
          output: {x2r, y2r},
        } = structure;
        [x0r, y0r, x1r, y1r, xtr, ytr, l2tr, x2r, y2r].forEach((r) =>
          set.add(r)
        );
        break;
      }
    }
  }
  return Array.from(set);
}

export function internalize(ext: LinkageExternal): LinkageInternal {
  const theta = 0;
  const vars = {...ext.initialVars};
  const structures = [];
  const initialVars: {[r]: number} = {};

  const {getXR, getYR, getLR} = makeRefCounters(getVarNamesExternal(ext));

  for (const structure of ext.structures) {
    switch (structure.type) {
      case 'rotary': {
        const {
          input: {x0r, y0r, lr},
          output: {x1r, y1r},
        } = structure;
        const {[x0r]: x0, [y0r]: y0, [lr]: l0} = vars;
        vars[x1r] = l0 * cos(theta) + x0;
        vars[y1r] = l0 * sin(theta) + y0;

        structures.push(structure);

        initialVars[x0r] = x0;
        initialVars[y0r] = y0;
        initialVars[lr] = l0;
        break;
      }
      case 'hinge': {
        const {
          input: {x0r, y0r, x1r, y1r, l0r, l1r},
          output: {x2r, y2r},
        } = structure;
        const {
          [x0r]: x0,
          [y0r]: y0,
          [x1r]: x1,
          [y1r]: y1,
          [l0r]: l0,
          [l1r]: l1,
        } = vars;
        const hinge = calcHinge(x0, y0, x1, y1, l0, l1);
        const [x2, y2] = hinge.p2;
        vars[x2r] = x2;
        vars[y2r] = y2;

        const xtr = getXR();
        const ytr = getYR();
        const l2tr = getLR();

        structures.push({
          type: 'hinge',
          input: {x0r, y0r, x1r, y1r, xtr, ytr, l2tr},
          output: {x2r, y2r},
        });

        const {xt, yt, l2} = hinge;
        initialVars[xtr] = xt;
        initialVars[ytr] = yt;
        initialVars[l2tr] = l2;
        for (const r of [x0r, y0r, x1r, y1r]) {
          if (ext.initialVars[r] != null) {
            initialVars[r] = vars[r];
          }
        }
        break;
      }
    }
  }
  return {initialVars, structures};
}

export function externalize(intern: LinkageInternal): LinkageExternal {
  const theta = 0;
  const vars = {...intern.initialVars};
  const structures = [];
  const initialVars: {[r]: number} = {};

  const {getXR, getYR, getLR} = makeRefCounters(getVarNamesInternal(intern));

  for (const structure of intern.structures) {
    switch (structure.type) {
      case 'rotary': {
        const {
          input: {x0r, y0r, lr},
          output: {x1r, y1r},
        } = structure;
        const {[x0r]: x0, [y0r]: y0, [lr]: l0} = vars;
        vars[x1r] = l0 * cos(theta) + x0;
        vars[y1r] = l0 * sin(theta) + y0;

        structures.push(structure);

        initialVars[x0r] = x0;
        initialVars[y0r] = y0;
        initialVars[lr] = l0;
        break;
      }
      case 'hinge': {
        const {
          input: {xtr, ytr, l2tr, x0r, y0r, x1r, y1r},
          output: {x2r, y2r},
        } = structure;
        const {
          [xtr]: xt,
          [ytr]: yt,
          [l2tr]: l2t,
          [x0r]: x0,
          [y0r]: y0,
          [x1r]: x1,
          [y1r]: y1,
        } = vars;
        const hinge = calcHingeInternal(x0, y0, x1, y1, xt, yt, l2t);
        const [x2, y2] = hinge.p2;
        vars[x2r] = x2;
        vars[y2r] = y2;

        const l0r = getLR();
        const l1r = getLR();

        structures.push({
          type: 'hinge',
          input: {l0r, l1r, x0r, y0r, x1r, y1r},
          output: {x2r, y2r},
        });

        const {l0, l1} = hinge;
        initialVars[l0r] = l0;
        initialVars[l1r] = l1;
        for (const r of [x0r, y0r, x1r, y1r]) {
          if (intern.initialVars[r] != null) {
            initialVars[r] = vars[r];
          }
        }
        break;
      }
    }
  }
  return {initialVars, structures};
}

export function calcLinkageInternal(
  linkage: LinkageInternal,
  theta: number
): {[r]: number} {
  const vars = {...linkage.initialVars};
  for (const structure of linkage.structures) {
    switch (structure.type) {
      case 'rotary': {
        const {
          input: {x0r, y0r, lr},
          output: {x1r, y1r},
        } = structure;
        const {[x0r]: x0, [y0r]: y0, [lr]: l0} = vars;
        vars[x1r] = l0 * cos(theta) + x0;
        vars[y1r] = l0 * sin(theta) + y0;
        break;
      }

      case 'hinge': {
        const {
          input: {x0r, y0r, x1r, y1r, xtr, ytr, l2tr},
          output: {x2r, y2r},
        } = structure;
        const {
          [x0r]: x0,
          [y0r]: y0,
          [x1r]: x1,
          [y1r]: y1,
          [xtr]: xt,
          [ytr]: yt,
          [l2tr]: l2t,
        } = vars;
        const [x2, y2] = calcHingeInternal(x0, y0, x1, y1, xt, yt, l2t).p2;
        vars[x2r] = x2;
        vars[y2r] = y2;
        break;
      }
    }
  }
  return vars;
}

export function calcPathInternal(
  linkage: LinkageInternal,
  pr: string = '0',
  n: number = 125
): Lines {
  const path = [];
  const [xr, yr] = prefToRefs(pr);
  for (let i = 0; i < n; i++) {
    const vars = calcLinkageInternal(linkage, (i * Math.PI * 2) / n);
    path.push([vars[xr], vars[yr]]);
  }
  path.push(path[0]);
  return path;
}
