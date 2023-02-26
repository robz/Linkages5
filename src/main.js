/* @flow */

'use strict';

import type {Linkage} from './linkage';

import {getCanvas, continuallyResize, getAxis, getMousePos} from './drawing';
import {drawStuff} from './drawing_linkage';
import {internalize, externalize, calcLinkage, calcPath} from './linkage';
import {
  buildPointMap,
  getNearestPoint,
  movePoint,
  getClickablePointkeys,
} from './move_point';
import {
  INIT_STATE,
  getActionFromMouseUp,
  reduce,
  doEffect,
  drawPreview,
} from './add_link';

// linkage
const fourBarCoupler: Linkage = {
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

const TRACE_POINT_REF = '4';

// mutable state
let linkage = externalize(internalize(fourBarCoupler));
let pointMap = buildPointMap(linkage);
let path = calcPath(linkage, TRACE_POINT_REF);
let theta = 3.7;
let vars = calcLinkage(linkage, theta);
let paused = false;
let mouseDown = null;
let mouseHover = null;
let addLinkState = INIT_STATE;
let dragging = false;
let mousePos = null;

window.onkeydown = (event: KeyboardEvent) => {
  if (event.key === ' ') {
    paused = !paused;
    mouseDown = null;
    mouseHover = null;
    if (!paused) {
      addLinkState = reduce(addLinkState, {t: 'esc'}, linkage, vars).state;
    }
  } else if (event.key === 'Escape') {
    addLinkState = reduce(addLinkState, {t: 'esc'}, linkage, vars).state;
  }
};

canvas.onmousedown = (event: MouseEvent) => {
  if (addLinkState.t !== 'none') {
    // don't allow moving points while adding links
    return;
  }

  dragging = false;
  const mousePos = getMousePos(event, ctx);
  const keys = getClickablePointkeys(paused, pointMap);
  mouseDown = getNearestPoint(mousePos, keys, vars, pointThreshold);
};

canvas.onmouseup = (event: MouseEvent) => {
  mouseDown = null;
  if (dragging) {
    // don't allow adding links while moving points
    return;
  }
  if (!paused) {
    // don't allow adding links unless paused
    return;
  }

  const mousePos = getMousePos(event, ctx);
  const keys = getClickablePointkeys(paused, pointMap);
  const nearestPoint = getNearestPoint(mousePos, keys, vars, pointThreshold);

  const action = getActionFromMouseUp(mousePos, nearestPoint);
  const result = reduce(addLinkState, action, linkage, vars);
  addLinkState = result.state;
  if (result.effect) {
    linkage = doEffect(result.effect, linkage, vars);
    pointMap = buildPointMap(linkage);
    vars = calcLinkage(linkage, theta);
  }
  console.log(addLinkState);
};

canvas.onmousemove = (event: MouseEvent) => {
  mousePos = getMousePos(event, ctx);
  if (!mouseDown) {
    const keys = getClickablePointkeys(paused, pointMap);
    mouseHover = getNearestPoint(mousePos, keys, vars, pointThreshold);
    return;
  }
  dragging = true;
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
  if (mousePos != null) {
    drawPreview(addLinkState, mousePos, ctx, vars);
  }

  if (!paused) {
    theta += 0.05;
  }

  window.requestAnimationFrame(draw);
}

window.requestAnimationFrame(draw);
