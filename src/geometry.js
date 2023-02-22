/* @flow */

'use strict';

type Point = [number, number];

export function euclid([x1, y1]: Point, [x2, y2]: Point): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}
