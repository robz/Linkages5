/* @flow */

'use strict';

export type Point = [number, number];
export type Lines = Array<Point>;

const {sin, cos, acos, atan2, min, max, sqrt, PI} = Math;

export function drawLines(ctx: CanvasRenderingContext2D, lines: Lines) {
  ctx.beginPath();
  for (let i = 0; i < lines.length - 1; i++) {
    ctx.moveTo(...lines[i]);
    ctx.lineTo(...lines[i + 1]);
  }
  ctx.stroke();
}

export function fillCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, PI * 2);
  ctx.fill();
}

export function getCanvas(id: string): HTMLCanvasElement {
  const canvas = document.getElementById(id);
  if (!(canvas instanceof HTMLCanvasElement) || canvas == null) {
    throw new Error('could not find canvas');
  }
  return canvas;
}

export function getAxis(canvas: HTMLCanvasElement): [number, number] {
  const smallAxis = min(canvas.width, canvas.height) / 2;
  const bigAxis = max(canvas.width, canvas.height) / smallAxis;
  return [smallAxis, bigAxis];
}

export function continuallyResize(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
) {
  function f() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 20;

    const [smallAxis] = getAxis(canvas);
    ctx.transform(
      smallAxis,
      0,
      0,
      -smallAxis,
      canvas.width / 2,
      canvas.height / 2
    );
    ctx.lineWidth = 4 / smallAxis;
    ctx.lineCap = 'round';
    ctx.fillStyle = 'red';
  }
  window.onresize = f;
  f();
}

export function getMousePos(
  event: MouseEvent,
  ctx: CanvasRenderingContext2D
): [number, number] {
  const {clientX, clientY} = event;
  // $FlowFixMe
  const {a, b, c, d, e, f} = ctx.getTransform();
  return [(clientX - e) / a, (clientY - f) / d];
}
