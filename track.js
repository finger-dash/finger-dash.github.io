// Geometry of a 400 m oval, run counterclockwise.
//
// Positions are expressed as (s, n):
//   s  distance along the reference line, in meters (0 = start/finish line)
//   n  lateral offset from it, positive towards the outside (runner's right)
// Every lane shares the same s, so no staggered start is needed.
(function (root) {
  'use strict';

  const LENGTH = 400;
  const STRAIGHT = 84.39;
  const RADIUS = (LENGTH - 2 * STRAIGHT) / (2 * Math.PI);
  const LANES = 6;
  const LANE_WIDTH = 1.25;
  const HALF_WIDTH = (LANES * LANE_WIDTH) / 2;
  const ARC = Math.PI * RADIUS;
  const HALF = STRAIGHT / 2;

  const laneOffset = (lane) => -HALF_WIDTH + (lane + 0.5) * LANE_WIDTH;

  // (s, n) -> world {x, y, heading}. Heading grows as the track turns left.
  function pointAt(s, n) {
    s = ((s % LENGTH) + LENGTH) % LENGTH;
    let x, y, heading;
    if (s < STRAIGHT) {                         // bottom straight
      x = -HALF + s; y = -RADIUS; heading = 0;
    } else if (s < STRAIGHT + ARC) {            // right bend
      heading = (s - STRAIGHT) / RADIUS;
      x = HALF + RADIUS * Math.sin(heading); y = -RADIUS * Math.cos(heading);
    } else if (s < 2 * STRAIGHT + ARC) {        // back straight
      x = HALF - (s - STRAIGHT - ARC); y = RADIUS; heading = Math.PI;
    } else {                                    // left bend
      heading = Math.PI + (s - 2 * STRAIGHT - ARC) / RADIUS;
      x = -HALF + RADIUS * Math.sin(heading); y = -RADIUS * Math.cos(heading);
    }
    return { x: x + n * Math.sin(heading), y: y - n * Math.cos(heading), heading };
  }

  // World (x, y) -> (s, n). Writes into `out` to avoid per-pixel allocations.
  function locate(x, y, out) {
    if (x > HALF || x < -HALF) {
      const right = x > 0;
      const dx = x - (right ? HALF : -HALF);
      out.n = Math.sqrt(dx * dx + y * y) - RADIUS;
      let a = Math.atan2(y, dx);
      if (right) {
        out.s = STRAIGHT + RADIUS * (a + Math.PI / 2);
      } else {
        if (a < 0) a += 2 * Math.PI;
        out.s = 2 * STRAIGHT + ARC + RADIUS * (a - Math.PI / 2);
      }
    } else if (y < 0) {
      out.n = -y - RADIUS; out.s = x + HALF;
    } else {
      out.n = y - RADIUS; out.s = STRAIGHT + ARC + HALF - x;
    }
    return out;
  }

  const api = { LENGTH, STRAIGHT, RADIUS, LANES, LANE_WIDTH, HALF_WIDTH, laneOffset, pointAt, locate };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Track = api;
})(this);
