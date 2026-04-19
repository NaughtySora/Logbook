"use strict";

const formatter = require("../lib/formatter.js");
const { describe } = require("node:test");

describe('formatter', () => {
  const noStack = new SyntaxError("test");
  noStack.stack = null;

  const tests = [
    new Error("test"),
    1n,
    new Set([1, 2, 3]),
    new Map([[1, 2]]),
    Symbol("1"),
    new WeakMap(),
    new WeakRef({}),
    new WeakSet(),
    "test",
    true,
    12.23,
    () => { },
    async () => { },
    undefined,
    null,
    new RegExp(),
    [1, 2, "test", new Map()],
    { 1: 2, test() { }, s: Symbol("123123") },
    "string",
    10,
    125.123,
    Infinity,
    NaN,
    -1,
    true,
    false,
    { test: [1, 2,], test2: ["test", 22, true, { test: 1, bool: true, big: 1n }] },
    new Map([[() => { }, 2], [{ a: "a" }, { value: 33 }]]),
    new Set([[1, 2], [0, [123]]]),
    noStack,
    123n,
    async () => { },
    new WeakMap(),
    {},
    [],
    Symbol("Symbol value1"),
    new Proxy({}, {}),
    new Date(),
    new RegExp(),
    new Intl.DateTimeFormat(),
    Atomics,
  ];
  for (const test of tests) formatter(test);
});


