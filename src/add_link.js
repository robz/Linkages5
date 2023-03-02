/* @flow */

import type {Point} from './drawing';
import type { Linkage, LinkageInternal, r } from "./linkage";

import {drawLines} from './drawing';
import {euclid} from './geometry';
import {
  calcHingeFromPoints,
  calcPath,
  calcPathInternal,
  getNs,
} from "./linkage";

type PointRef = [r, r];

type State =
  | {t: 'none'}
  | {t: 'g', p0: Point}
  | {t: 'gg', p0: Point, p1: Point}
  | {t: 'p', p0r: PointRef}
  | {t: 'pp', p0r: PointRef, p1r: PointRef}
  | {t: 'pg', p0r: PointRef, p1: Point};

type Action = {t: 'esc'} | {t: 'g', p0: Point} | {t: 'p', p0r: PointRef};
//| {action: 'pp', p0: PointRef, p1: PointRef}

type SideEffect =
  | {t: 'ppg', p0r: PointRef, p1r: PointRef, p2: Point}
  | {t: 'pgg', p0r: PointRef, p1: Point, p2: Point};

export const INIT_STATE: State = {t: 'none'};

export function getActionFromMouseUp(p0: Point, p0r: ?PointRef): Action {
  return p0r == null ? {t: 'g', p0} : {t: 'p', p0r};
}

export function doEffect(
  effect: SideEffect,
  {structures, initialVars}: Linkage,
  vars: {[r]: number}
): Linkage {
  const {getXR, getYR, getLR} = getNs(Object.keys(vars));

  const l0r = getLR();
  const l1r = getLR();

  switch (effect.t) {
    case 'ppg': {
      const {p0r, p1r, p2} = effect;
      const [x0r, y0r] = p0r;
      const [x1r, y1r] = p1r;
      const {[x0r]: x0, [x1r]: x1, [y0r]: y0, [y1r]: y1} = vars;
      const x2r = getXR();
      const y2r = getYR();
      initialVars = {
        ...initialVars,
        [l0r]: euclid([x0, y0], p2),
        [l1r]: euclid([x1, y1], p2),
      };
      structures = [
        ...structures,
        {
          type: 'hinge',
          input: {l0r, l1r, x0r, y0r, x1r, y1r},
          output: {x2r, y2r},
        },
      ];
      break;
    }
    case 'pgg': {
      const {
        p0r,
        p1: [x1, y1],
        p2,
      } = effect;
      const [x0r, y0r] = p0r;
      const {[x0r]: x0, [y0r]: y0} = vars;
      const x1r = getXR();
      const y1r = getYR();
      const x2r = getXR();
      const y2r = getYR();
      initialVars = {
        ...initialVars,
        [l0r]: euclid([x0, y0], p2),
        [l1r]: euclid([x1, y1], p2),
        [x1r]: x1,
        [y1r]: y1,
      };
      structures = [
        ...structures,
        {
          type: 'hinge',
          input: {l0r, l1r, x0r, y0r, x1r, y1r},
          output: {x2r, y2r},
        },
      ];
      break;
    }
  }

  return {structures, initialVars};
}

export function doEffectInternal(
  effect: SideEffect,
  {structures, initialVars}: LinkageInternal,
  vars: {[r]: number}
): LinkageInternal {
  const {getXR, getYR, getLR} = getNs(Object.keys(vars));

  const l2tr = getLR();

  switch (effect.t) {
    case 'ppg': {
      const {p0r, p1r, p2: [x2, y2]} = effect;
      const [x0r, y0r] = p0r;
      const [x1r, y1r] = p1r;
      const {[x0r]: x0, [x1r]: x1, [y0r]: y0, [y1r]: y1} = vars;
      const {xt, yt, l2} = calcHingeFromPoints(
        [x0, y0],
        [x1, y1],
        [x2, y2]
      );

      const x2r = getXR();
      const y2r = getYR();
      const xtr = getXR();
      const ytr = getYR();
      initialVars = {
        ...initialVars,
        [xtr]: xt,
        [ytr]: yt,
        [l2tr]: l2,
      };
      structures = [
        ...structures,
        {
          type: 'hinge',
          input: {xtr, ytr, l2tr, x0r, y0r, x1r, y1r},
          output: {x2r, y2r},
        },
      ];
      break;
    }
    case 'pgg': {
      const {
        p0r,
        p1: [x1, y1],
        p2: [x2, y2],
      } = effect;
      const [x0r, y0r] = p0r;
      const {[x0r]: x0, [y0r]: y0} = vars;
      const {xt, yt, l2} = calcHingeFromPoints(
        [x0, y0],
        [x1, y1],
        [x2, y2]
      );

      const x1r = getXR();
      const y1r = getYR();
      const x2r = getXR();
      const y2r = getYR();
      const xtr = getXR();
      const ytr = getYR();
      initialVars = {
        ...initialVars,
        [x1r]: x1,
        [y1r]: y1,
        [xtr]: xt,
        [ytr]: yt,
        [l2tr]: l2,
      };
      structures = [
        ...structures,
        {
          type: 'hinge',
          input: {xtr, ytr, l2tr, x0r, y0r, x1r, y1r},
          output: {x2r, y2r},
        },
      ];
      break;
    }
  }

  return {structures, initialVars};
}

function simulate(
  oldState: State,
  newState: State,
  effect: SideEffect,
  linkage: LinkageInternal,
  vars: {[r]: number}
): {state: State, effect?: SideEffect} {
  const newLinkage = doEffectInternal(effect, linkage, vars);
  try {
    calcPathInternal(newLinkage);
    return {state: newState, effect};
  } catch(e) {
    console.log('simulate error', e);
    return {state: oldState};
  }
}

export function reduce(
  state: State,
  action: Action,
  linkage: LinkageInternal,
  vars: {[r]: number}
): {state: State, effect?: SideEffect} {
  if (action.t === 'esc') {
    return {state: INIT_STATE};
  }
  switch (state.t) {
    case 'none':
      return {state: action};
    case 'g':
      switch (action.t) {
        case 'g':
          return {state: {...state, t: 'gg', p1: action.p0}};
        case 'p':
          return {state: {...action, t: 'pg', p1: state.p0}};
      }
      break;
    case 'p':
      switch (action.t) {
        case 'g':
          return {state: {...state, t: 'pg', p1: action.p0}};
        case 'p':
          return {state: {...action, t: 'pp', p1r: state.p0r}};
      }
      break;
    case 'gg':
      switch (action.t) {
        case 'g':
          return {state};
        case 'p':
          return simulate(
            state,
            INIT_STATE,
            {...action, t: 'pgg', p1: state.p0, p2: state.p1},
            linkage,
            vars
          );
      }
      break;
    case 'pp':
      switch (action.t) {
        case 'g':
          return simulate(
            state,
            INIT_STATE,
            {...state, t: 'ppg', p2: action.p0},
            linkage,
            vars
          );
        case 'p':
          return {state};
      }
      break;
    case 'pg':
      switch (action.t) {
        case 'g':
          return simulate(
            state,
            INIT_STATE,
            {...state, t: 'pgg', p2: action.p0},
            linkage,
            vars
          );
        case 'p':
          return simulate(
            state,
            INIT_STATE,
            {t: 'ppg', p0r: state.p0r, p1r: action.p0r, p2: state.p1},
            linkage,
            vars
          );
      }
      break;
  }
}

export function drawPreview(
  state: State,
  mousePos: Point,
  ctx: CanvasRenderingContext2D,
  vars: {[r]: number}
) {
  let lines = [];
  switch (state.t) {
    case 'p': {
      const {
        p0r: [x0r, y0r],
      } = state;
      const {[x0r]: x0, [y0r]: y0} = vars;
      lines = [[x0, y0], mousePos];
      break;
    }
    case 'g':
      lines = [state.p0, mousePos];
      break;
    case 'gg':
      lines = [state.p0, state.p1, mousePos];
      break;
    case 'pp': {
      const {
        p0r: [x0r, y0r],
        p1r: [x1r, y1r],
      } = state;
      const {[x0r]: x0, [y0r]: y0, [x1r]: x1, [y1r]: y1} = vars;
      lines = [[x0, y0], mousePos, [x1, y1]];
      break;
    }
    case 'pg': {
      const {
        p0r: [x0r, y0r],
      } = state;
      const {[x0r]: x0, [y0r]: y0} = vars;
      lines = [[x0, y0], mousePos, state.p1];
      break;
    }
  }
  ctx.strokeStyle = 'pink';
  drawLines(ctx, lines);
}
