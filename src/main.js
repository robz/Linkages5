/* @flow */

'use strict';

import type {LinkageExternal} from './linkage';

import {getCanvas, continuallyResize, getAxis, getMousePos} from './drawing';
import {drawStuff} from './drawing_linkage';
import {
  internalize,
  calcLinkageInternal,
  calcPathInternal,
  refToPRef,
} from './linkage';
import {
  buildPointMap,
  movePoint,
  getClickablePointkeys,
  getNearestPoint,
  tryRemovePoint,
} from './move_point';
import {
  INIT_STATE,
  getActionFromMouseUp,
  reduce,
  drawPreview,
  doEffect,
} from './add_link';
import type {Lines} from './drawing';

// linkage
const fourBarCoupler: LinkageExternal = {
  structures: [
    {
      type: 'rotary',
      input: {lr: 'l0', x0r: 'x0', y0r: 'y0', fr: 'f0'},
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
    f0: 0.0,
  },
};

const canvas = getCanvas('canvas');
const ctx = canvas.getContext('2d');
continuallyResize(ctx, canvas);
const pointThreshold = ctx.lineWidth * 2;
const [_smallAxis, bigAxis] = getAxis(canvas);

// mutable state
let tracePointRef: ?string = '4';
let linkage = internalize(fourBarCoupler);
let pointMap = buildPointMap(linkage);
let path: ?Lines = calcPathInternal(linkage, tracePointRef);
let hoverTraceRef = null;
let hoverPath = null;
let theta = 3.7;
let vars = calcLinkageInternal(linkage, theta);
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
  } else if (event.key === 't' && mouseHover != null && hoverPath != null) {
    path = hoverPath;
    tracePointRef = refToPRef(mouseHover[0]);
  } else if (event.key === 'd' && mouseHover != null) {
    const success = tryRemovePoint(mouseHover, pointMap, linkage);
    if (success) {
      // regenerate the point map
      pointMap = buildPointMap(linkage);
      // remove traces if necessary
      if (hoverTraceRef === tracePointRef) {
        tracePointRef = null;
        path = null;
      }
      hoverTraceRef = null;
      hoverPath = null;
    }
  }
};

canvas.onmousedown = (event: MouseEvent) => {
  if (addLinkState.t !== 'none') {
    // don't allow moving points while adding links
    return;
  }

  dragging = false;
  const mousePos = getMousePos(event, ctx);
  const keys = getClickablePointkeys(paused, pointMap, linkage.initialVars);
  mouseDown = getNearestPoint(mousePos, keys, vars, pointThreshold);
};

canvas.onmouseup = (event: MouseEvent) => {
  const wasDragging = dragging;
  dragging = false;
  mouseDown = null;
  if (wasDragging) {
    // don't allow adding links while moving points
    return;
  }
  if (!paused && addLinkState.t !== 'r') {
    // don't allow adding links unless paused
    // unless adding rotaries
    return;
  }

  const mousePos = getMousePos(event, ctx);
  const keys = getClickablePointkeys(paused, pointMap, linkage.initialVars);
  const nearestPoint = getNearestPoint(mousePos, keys, vars, pointThreshold);

  const action = getActionFromMouseUp(mousePos, nearestPoint);
  const result = reduce(addLinkState, action, linkage, vars);
  addLinkState = result.state;
  if (result.effect) {
    linkage = doEffect(result.effect, linkage, vars);
    pointMap = buildPointMap(linkage);
    vars = calcLinkageInternal(linkage, theta);
  }
};

canvas.onmousemove = (event: MouseEvent) => {
  mousePos = getMousePos(event, ctx);
  if (!mouseDown) {
    const keys = getClickablePointkeys(paused, pointMap, linkage.initialVars);
    const newMouseHover = getNearestPoint(mousePos, keys, vars, pointThreshold);
    if (
      // hovering over a point
      newMouseHover != null &&
      // hovering over a different point than before
      (mouseHover == null || newMouseHover[0] != mouseHover[0]) &&
      // the point isn't on ground
      linkage.initialVars[newMouseHover[0]] == null
    ) {
      hoverTraceRef = refToPRef(newMouseHover[0]);
      // the point isn't one we're already tracing
      if (hoverTraceRef !== tracePointRef) {
        hoverPath = calcPathInternal(linkage, hoverTraceRef);
      }
    } else if (newMouseHover == null) {
      hoverPath = null;
      hoverTraceRef = null;
    }
    mouseHover = newMouseHover;
    return;
  }
  dragging = true;
  const result = movePoint(
    mouseDown,
    mousePos,
    pointMap,
    linkage,
    theta,
    vars,
    tracePointRef
  );
  if (result) {
    linkage.initialVars = result.vars;
    path = result.path;
    if (hoverTraceRef != null) {
      hoverPath = calcPathInternal(linkage, hoverTraceRef);
    }
  }
};

const addRotaryLink = document.getElementById('add-rotary');
// $FlowFixMe
addRotaryLink.onclick = () => {
  addLinkState = {t: 'r'};
};

function draw() {
  try {
    vars = calcLinkageInternal(linkage, theta);
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
    [path, hoverPath],
    mouseDown && [vars[mouseDown[0]], vars[mouseDown[1]]],
    mouseHover && [vars[mouseHover[0]], vars[mouseHover[1]]]
  );
  if (mousePos != null) {
    drawPreview(addLinkState, mousePos, theta, ctx, vars);
  }

  if (!paused) {
    theta += 0.05;
  }

  window.requestAnimationFrame(draw);
}

window.requestAnimationFrame(draw);
