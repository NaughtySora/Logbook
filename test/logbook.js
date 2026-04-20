"use strict";

const path = require("node:path");
const { LogBook } = require("../main");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { async } = require("naughty-util");

const LOGS = "logs";
const LOGS_PATH = path.resolve(__dirname, `../${LOGS}`);

try {
  fs.accessSync(LOGS_PATH);
} catch {
  fs.mkdirSync(LOGS_PATH);
}

const resetDir = filename => {
  const logs = path.resolve(LOGS_PATH, filename);
  fs.rmSync(logs, { force: true, recursive: true });
  return logs;
};

describe("LogBook", async () => {
  await it("log", async () => {
    const dir = resetDir("log");
    const logger = await new LogBook({ dir });
    const logs = [
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
      new Error("test"),
      123n,
      async () => { },
      new WeakMap(),
      {},
      [],
      Symbol("Symbol value1"),
      new Proxy({}, {}),
      new Date(),
    ];
    for (const log of logs) {
      logger.log(log);
      logger.error(log);
      logger.warn(log);
      logger.info(log);
    }
  });

  await it("rotate", async () => {
    const dir = resetDir("rotate");
    const logger = await new LogBook({ dir, rotation: 1000 });
    logger.log("hello-0");
    await async.pause(1000);
    logger.log("hello-1");
  });

  await it("delete", async () => {
    const dir = resetDir("delete");
    const logger = await new LogBook({ dir, rotation: 1000 });
    logger.error(new Error("abc"));
    await async.pause(2000);
    logger.error(new Error("abcd"));
    const deleted = await logger.delete("error");
    assert.equal(deleted.length, 1);
  });

  await it("cursor", async () => {
    const dir = resetDir("cursor");
    const logger = await new LogBook({ dir, rotation: 1000 });
    logger.warn("abc");
    logger.warn("abcd");
    await async.pause(2000);
    logger.warn("abcde");
    const cursor = await logger.cursor("warn");
    const files = [];
    for await (const file of cursor) files.push(file);
    assert.ok(files.length > 0);
  });

  await it("close", async () => {
    const dir = resetDir("close");
    const logger = await new LogBook({ dir, rotation: 1000 });
    logger.warn("abc");
    logger.error("abcd");
    logger.close();
    assert.ok(logger.closed);
    resetDir("close");
    logger.log("nope");
  });
});
