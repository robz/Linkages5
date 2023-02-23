/* @flow */

'use strict';

import type {Point} from './drawing';

import {getCanvas, continuallyResize, getAxis, getMousePos} from './drawing';
import {drawStuff} from './drawing_linkage';
import {calcLinkage, calcPath} from './linkage';
import {
  buildPointMap,
  getNearestPoint,
  movePoint,
  getClickablePointkeys,
} from './move_point';

// linkage
const linkage = {
  structures: [
    {
      type: 'rotary',
      input: {lr: 'l0', x0r: 'x0', y0r: 'y0'},
      output: {x1r: 'x1', y1r: 'y1'},
    },
    {
      type: 'hinge',
      input: {
        l0r: 'l1',
        l1r: 'l2',
        x0r: 'x1',
        y0r: 'y1',
        x1r: 'x3',
        y1r: 'y3',
      },
      output: {x2r: 'x2', y2r: 'y2'},
    },
    {
      type: 'hinge',
      input: {
        l0r: 'l3',
        l1r: 'l4',
        x0r: 'x2',
        y0r: 'y2',
        x1r: 'x1',
        y1r: 'y1',
      },
      output: {x2r: 'x4', y2r: 'y4'},
    },
  ],
  initialVars: {
    l0: 0.25,
    l1: 0.5,
    l2: 0.5,
    l3: 0.8,
    l4: 0.5,
    x0: -0.4,
    y0: 0.0,
    x3: 0.3,
    y3: 0.0,
  },
};

const canvas = getCanvas('canvas');
const ctx = canvas.getContext('2d');
continuallyResize(ctx, canvas);
const pointThreshold = ctx.lineWidth * 2;
const [_smallAxis, bigAxis] = getAxis(canvas);

const pointMap = buildPointMap(linkage);
const TRACE_POINT_REF = '4';

// mutable state
let path = calcPath(linkage, TRACE_POINT_REF);
let theta = 3.7;
let vars = calcLinkage(linkage, theta);
let paused = false;
let mouseDown = null;
let mouseHover = null;

window.onkeydown = (event: KeyboardEvent) => {
  if (event.key === ' ') {
    paused = !paused;
    mouseDown = null;
    mouseHover = null;
  }
};

canvas.onmousedown = (event: MouseEvent) => {
  const mousePos = getMousePos(event, ctx);
  const keys = getClickablePointkeys(paused, pointMap);
  mouseDown = getNearestPoint(mousePos, keys, vars, pointThreshold);
};

canvas.onmouseup = () => (mouseDown = null);

canvas.onmousemove = (event: MouseEvent) => {
  const mousePos = getMousePos(event, ctx);
  if (!mouseDown) {
    const keys = getClickablePointkeys(paused, pointMap);
    mouseHover = getNearestPoint(mousePos, keys, vars, pointThreshold);
    return;
  }
  const oldPoint = [vars[mouseDown[0]], vars[mouseDown[1]]];
  const result = movePoint(
    mouseDown,
    oldPoint,
    mousePos,
    pointMap,
    linkage,
    theta,
    vars,
    TRACE_POINT_REF
  );
  if (result) {
    linkage.initialVars = result[0];
    theta = result[1];
    path = result[2];
  }
};

function draw() {
  try {
    vars = calcLinkage(linkage, theta);
  } catch (_) {
    theta += 0.05;
    window.requestAnimationFrame(draw);
    return;
  }

  drawStuff(
    ctx,
    canvas,
    bigAxis,
    linkage,
    vars,
    path,
    mouseDown && [vars[mouseDown[0]], vars[mouseDown[1]]],
    mouseHover && [vars[mouseHover[0]], vars[mouseHover[1]]]
  );

  if (!paused) {
    theta += 0.05;
  }

  window.requestAnimationFrame(draw);
}

window.requestAnimationFrame(draw);
