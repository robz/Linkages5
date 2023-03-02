/* @flow */

'use strict';

import type {Lines, Point} from './drawing';
import type {Linkage, LinkageInternal, r} from './linkage';

import {euclid} from './geometry';
import {
  calcHingeFromPoints,
  calcPathInternal,
  prefToRefs,
  refToPRef,
} from './linkage';

export type PointMap = {
  [r]: Array<number>,
};

function push(m: PointMap, k: string, x: number) {
  m[k] = m[k] || [];
  m[k].push(x);
}

export function buildPointMap({structures}: LinkageInternal): PointMap {
  const m: PointMap = {};
  const rotaryPoints = [];
  structures.forEach((structure, i) => {
    switch (structure.type) {
      case 'rotary': {
        const {
          input: {x0r},
          output: {x1r},
        } = structure;
        push(m, x0r, i);
        push(m, x1r, i);
        rotaryPoints.push(x1r);
        break;
      }

      case 'hinge': {
        const {
          input: {x0r, x1r},
          output: {x2r},
        } = structure;
        push(m, x0r, i);
        push(m, x1r, i);
        push(m, x2r, i);
        break;
      }
    }
  });

  // remove all other structures from rotary points
  // since we just want the actuator to move in those cases
  for (const xr of rotaryPoints) {
    m[xr] = m[xr].filter((i) => structures[i].type === 'rotary');
  }

  return m;
}

export function movePoint(
  pointKey: [r, r],
  newPoint: Point,
  pointMap: PointMap,
  linkage: LinkageInternal,
  theta: number,
  vars: {[r]: number},
  tracePr: r
): ?{vars: {[r]: number}, theta: number, path: Lines} {
  const [xr, yr] = pointKey;
  const [x, y] = newPoint;

  const {structures, initialVars} = linkage;
  const newInitialVars = {...initialVars};
  let newTheta = theta;

  for (const i of pointMap[xr]) {
    const structure = structures[i];
    switch (structure.type) {
      case 'rotary': {
        const {
          input: {x0r, y0r, lr},
          output: {x1r, y1r},
        } = structure;
        const {[x0r]: x0, [y0r]: y0, [x1r]: x1, [y1r]: y1} = vars;

        if (x0r === xr) {
          // check if its a ground point
          if (initialVars[xr] != null) {
            newInitialVars[xr] = x;
            newInitialVars[yr] = y;
          } else {
            newInitialVars[lr] = euclid(newPoint, [x1, y1]);
            newTheta = Math.atan2(y1 - y, x1 - x);
          }
        } else if (x1r === xr) {
          newInitialVars[lr] = euclid([x0, y0], newPoint);
          newTheta = Math.atan2(y - y0, x - x0);
        }

        break;
      }

      case 'hinge': {
        const {
          input: {x0r, y0r, x1r, y1r, l2tr, xtr, ytr},
          output: {x2r, y2r},
        } = structure;
        const {
          [x0r]: x0,
          [y0r]: y0,
          [x1r]: x1,
          [y1r]: y1,
          [x2r]: x2,
          [y2r]: y2,
        } = vars;

        if (x0r === xr) {
          // check if its a ground point
          if (initialVars[xr] != null) {
            newInitialVars[xr] = x;
            newInitialVars[yr] = y;
          } else {
            const {xt, yt, l2} = calcHingeFromPoints(
              newPoint,
              [x1, y1],
              [x2, y2]
            );
            newInitialVars[l2tr] = l2;
            newInitialVars[xtr] = xt;
            newInitialVars[ytr] = yt;
          }
        } else if (x1r === xr) {
          // check if its a ground point
          if (initialVars[xr] != null) {
            newInitialVars[xr] = x;
            newInitialVars[yr] = y;
          } else {
            const {xt, yt, l2} = calcHingeFromPoints([x0, y0], newPoint, [
              x2,
              y2,
            ]);
            newInitialVars[l2tr] = l2;
            newInitialVars[xtr] = xt;
            newInitialVars[ytr] = yt;
          }
        } else if (x2r === xr) {
          const {xt, yt, l2} = calcHingeFromPoints(
            [x0, y0],
            [x1, y1],
            newPoint
          );
          newInitialVars[l2tr] = l2;
          newInitialVars[xtr] = xt;
          newInitialVars[ytr] = yt;
        }

        break;
      }
    }
  }
  try {
    const path = calcPathInternal(
      {structures, initialVars: newInitialVars},
      tracePr
    );
    return {vars: newInitialVars, theta: newTheta, path};
  } catch {
    return null;
  }
}

export function getClickablePointkeys(
  paused: boolean,
  pointMap: PointMap,
  initialVars: {[r]: number}
): Array<[r, r]> {
  let points = Object.keys(pointMap);
  if (!paused) {
    // only allow clicking on stationary/ground points if unpaused
    points = points.filter((pr) => initialVars[pr] != null);
  }
  return points.map((pr) => prefToRefs(refToPRef(pr)));
}
