// Abuse protections. Pure functions, so they can be tested without a network.
'use strict';

// Browsers always send Origin; rejecting unknown ones stops other websites from
// using the socket. Non-browser clients can forge it, hence the other limits.
function originAllowed(origin, allowed) {
  return typeof origin === 'string' && allowed.includes(origin);
}

// Token bucket: `rate` messages per second, bursts of up to `burst`.
function createBucket(rate, burst, now) {
  let tokens = burst;
  let last = now;
  return function take(time) {
    tokens = Math.min(burst, tokens + ((time - last) / 1000) * rate);
    last = time;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

// Returns the message object, or null if it is not a valid one.
function parseMessage(data) {
  let message;
  try {
    message = JSON.parse(data);
  } catch {
    return null;
  }
  const isObject = message !== null && typeof message === 'object' && !Array.isArray(message);
  return isObject && typeof message.type === 'string' ? message : null;
}

module.exports = { originAllowed, createBucket, parseMessage };
