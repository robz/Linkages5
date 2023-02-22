/* @flow */

import type {r, Linkage} from './linkage';
import type {Point, Lines} from './drawing';

import {drawLines, fillCircle} from './drawing';

export function drawLinkage(
  ctx: CanvasRenderingContext2D,
  linkage: Linkage,
  vars: {[r]: number}
) {
  for (const structure of linkage.structures) {
    switch (structure.type) {
      case 'rotary': {
        const {
          input: {x0r, y0r},
          output: {x1r, y1r},
        } = structure;
        const {[x0r]: x0, [y0r]: y0, [x1r]: x1, [y1r]: y1} = vars;
        drawLines(ctx, [
          [x0, y0],
          [x1, y1],
        ]);
        break;
      }

      case 'hinge': {
        const {
          input: {x0r, y0r, x1r, y1r},
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
        drawLines(ctx, [
          [x0, y0],
          [x2, y2],
          [x1, y1],
        ]);
        break;
      }
    }
  }
}

export function drawStuff(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  bigAxis: number,
  linkage: Linkage,
  vars: {[r]: number},
  path: Lines,
  downPoint: ?Point,
  hoverPoint: ?Point
) {
  ctx.clearRect(-bigAxis, -bigAxis, 2 * bigAxis, 2 * bigAxis);

  ctx.strokeStyle = 'black';
  drawLinkage(ctx, linkage, vars);

  ctx.strokeStyle = 'teal';
  drawLines(ctx, path);

  ctx.fillStyle = 'red';
  if (downPoint) {
    const [x, y] = downPoint;
    fillCircle(ctx, x, y, ctx.lineWidth);
  }

  if (hoverPoint) {
    const [x, y] = hoverPoint;
    fillCircle(ctx, x, y, ctx.lineWidth);
  }
}
