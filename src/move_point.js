/* @flow */

'use strict';

import type {Lines, Point} from './drawing';
import type {LinkageInternal, r} from './linkage';

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
  return m;
}

export function movePoint(
  pointKey: [r, r],
  newPoint: Point,
  pointMap: PointMap,
  linkage: LinkageInternal,
  theta: number,
  vars: {[r]: number},
  tracePr: ?r
): ?{vars: {[r]: number}, path: Lines} {
  const [xr, yr] = pointKey;
  const [x, y] = newPoint;

  const {structures, initialVars} = linkage;
  const newInitialVars = {...initialVars};

  const isEndEffector = pointMap[xr].some(
    (i) => structures[i].type === 'rotary' && structures[i].output.x1r === xr
  );

  for (const i of pointMap[xr]) {
    const structure = structures[i];
    switch (structure.type) {
      case 'rotary': {
        const {
          input: {x0r, y0r, lr, fr},
          output: {x1r, y1r},
        } = structure;
        const {[x0r]: x0, [y0r]: y0, [x1r]: x1, [y1r]: y1} = vars;
        const p0 = [x0, y0];
        const p1 = [x1, y1];

        if (x0r === xr) {
          // check if its a ground point
          if (initialVars[xr] != null) {
            newInitialVars[xr] = x;
            newInitialVars[yr] = y;
          } else {
            newInitialVars[lr] = euclid(newPoint, p1);
            const newTheta = Math.atan2(y1 - y, x1 - x);
            newInitialVars[fr] = newTheta - theta;
          }
        } else if (x1r === xr) {
          newInitialVars[lr] = euclid(p0, newPoint);
          const newTheta = Math.atan2(y - y0, x - x0);
          newInitialVars[fr] = newTheta - theta;
        }

        break;
      }

      case 'hinge': {
        if (isEndEffector) {
          // moving end effectors shouldn't alter hinges
          continue;
        }
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
        const p0 = [x0, y0];
        const p1 = [x1, y1];
        const p2 = [x2, y2];

        if (x0r === xr) {
          // check if its a ground point
          if (initialVars[xr] != null) {
            newInitialVars[xr] = x;
            newInitialVars[yr] = y;
          } else {
            const {xt, yt, l2} = calcHingeFromPoints(newPoint, p1, p2);
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
            const {xt, yt, l2} = calcHingeFromPoints(p0, newPoint, p2);
            newInitialVars[l2tr] = l2;
            newInitialVars[xtr] = xt;
            newInitialVars[ytr] = yt;
          }
        } else if (x2r === xr) {
          const {xt, yt, l2} = calcHingeFromPoints(p0, p1, newPoint);
          newInitialVars[l2tr] = l2;
          newInitialVars[xtr] = xt;
          newInitialVars[ytr] = yt;
        }

        break;
      }
    }
  }
  try {
    const tracePoint = tracePr ?? refToPRef(linkage.structures[0].input.x0r);
    const path = calcPathInternal(
      {structures, initialVars: newInitialVars},
      tracePoint
    );
    return {vars: newInitialVars, path};
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

export function getNearestPoint(
  p0: Point,
  keys: Array<[r, r]>,
  vars: {[r]: number},
  threshold: number
): ?[r, r] {
  for (const [xr, yr] of keys) {
    if (euclid(p0, [vars[xr], vars[yr]]) < threshold) {
      return [xr, yr];
    }
  }
}

export function tryRemovePoint(
  p: [r, r],
  pointMap: PointMap,
  linkage: LinkageInternal
): boolean {
  const [xr, yr] = p;
  const structureIndicies = pointMap[xr];
  if (structureIndicies.length !== 1) {
    // ønly remove if there's one structure connected to the point
    return false;
  }

  const structureIndex = structureIndicies[0];
  const structure = linkage.structures[structureIndex];
  switch (structure.type) {
    case 'rotary': {
      const {
        input: {x0r, y0r, lr, fr},
        output: {x1r, y1r},
      } = structure;
      console.log(x1r, pointMap, pointMap[x1r]);

      if (pointMap[x1r].length > 1) {
        // only remove if nothing is connected to the end effector
        return false;
      }

      // Remove the structure from the structure list
      linkage.structures.splice(structureIndex, 1);

      // Cleanup any initial vars
      delete linkage.initialVars[lr];
      delete linkage.initialVars[fr];

      // If there's only one structure using the ground,
      // then it's safe to delete, because that
      // structure is the one we're deleting
      if (pointMap[x0r].length === 1) {
        delete linkage.initialVars[x0r];
        delete linkage.initialVars[y0r];
      }

      return true;
    }
    case 'hinge': {
      const {
        input: {x0r, y0r, x1r, y1r, l2tr, xtr, ytr},
        output: {x2r, y2r},
      } = structure;
      if (x2r !== xr || y2r !== yr) {
        // only remove if the middle point is selected
        return false;
      }

      // Remove the structure from the structure list
      linkage.structures.splice(structureIndex, 1);

      // Cleanup any initial vars
      delete linkage.initialVars[l2tr];
      delete linkage.initialVars[xtr];
      delete linkage.initialVars[ytr];
      for (const [xr, yr] of [
        [x0r, y0r],
        [x1r, y1r],
      ]) {
        // If there's only one structure using this point,
        // then it's safe to delete, because that
        // structure is the one we're deleting
        if (pointMap[xr].length === 1) {
          delete linkage.initialVars[xr];
          delete linkage.initialVars[yr];
        }
      }

      return true;
    }
  }
}
