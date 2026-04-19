"use strict";

const { createWriteStream, promises: fs,
  mkdirSync, accessSync, } = require("node:fs");
const path = require("node:path");
const formatter = require("./formatter.js");
const setTimeoutLong = require("./setTimeoutLong.js");
const { misc } = require("naughty-util");

const FILE_TS = /^(?:.+_)(?<time>\d+)(?:\.log)$/;
const FILE_EXT = /\..+$/;
const CHANNELS = new Set(["log", "error", "info", "warn"]);

const createFolderSync = path => {
  try {
    accessSync(path);
  } catch {
    mkdirSync(path);
  }
};

const addTimestamp = ext => `_${Date.now()}${ext}`;

const collection = new Map();

class LogBook {
  #queues = {
    log: [], error: [],
    warn: [], info: [],
  };
  #timers = new Map();
  #streams = new Map();
  #meta = new Map();
  #dir;
  #rotation;
  #closed = false;

  constructor({ dir, rotation } = {}) {
    const instance = collection.get(dir);
    if (instance !== undefined) return instance;
    this.#dir = dir;
    this.#rotation = rotation;
    collection.set(dir, this);
    return this.#init();
  }

  async #init() {
    const dir = this.#dir;
    const meta = this.#meta;
    const promises = [];
    const noRotation = !Number.isFinite(this.#rotation);
    createFolderSync(dir);
    for (const channel of CHANNELS) {
      createFolderSync(path.resolve(dir, channel));
      this.#streams.set(channel, null);
      meta.set(channel, {
        path: this.#path(channel),
        channel,
        paused: false,
      });
      if (noRotation) continue;
      promises.push(this.#expired(channel));
    }
    if (promises.length > 0) await Promise.all(promises);
    return this;
  }

  async #expired(channel) {
    if (this.#closed) return;
    const path = this.#meta.get(channel).path;
    const stat = await this.#stat(path);
    try {
      if (stat.expired) {
        if (stat.size === 0) await this.#delete(channel, path);
        else await this.#rotate(channel, path);
      }
      this.#schedule({ channel, delay: stat.delay });
    } catch { }
  }

  async #schedule({ channel, delay }) {
    const timers = this.#timers;
    let timer = setTimeoutLong(() => {
      timers.delete(channel);
      timer = null;
      clearInterval(timer);
      this.#expired(channel);
    }, delay);
    timer.unref();
    timers.set(channel, timer);
  }

  async #rotate(channel, path) {
    try {
      this.#close(channel);
      await fs.rename(path, path.replace(FILE_EXT, addTimestamp));
    } catch { }
  }

  async #delete(channel, path) {
    try {
      this.#close(channel);
      await fs.unlink(path);
    } catch { }
  }

  async #stat(path) {
    const rotation = this.#rotation;
    try {
      const stat = await fs.stat(path);
      const diff = Date.now() - Math.floor(stat.birthtimeMs);
      const expired = diff > rotation;
      const delay = expired ? rotation : rotation - diff;
      return { delay, expired, size: stat.size };
    } catch {
      return { delay: rotation, expired: false, size: Infinity };
    }
  }

  #open(channel) {
    try {
      const stream = createWriteStream(this.#path(channel), { flags: "a+" });
      const ongoing = this.#streams.get(channel);
      this.#streams.get(channel, stream);
      if (ongoing) { ongoing.end(); ongoing.destroy(); }
      this.#resume(channel);
      return stream;
    } catch { }
  }

  #stringify(logs) {
    let result = `${new Date().toISOString()}: \n`;
    for (const log of logs) {
      try {
        result += `${formatter(log)} \n`;
      } catch (e) {
        result += "Error while parsing logs \n";
      }
    }
    return `${result}\n`;
  }

  #path(channel) {
    return path.resolve(this.#dir, channel, `${channel}.log`);
  }

  #resume(channel) {
    const queue = this.#queues[channel].slice(0);
    for (let i = 0; i < queue.length; i++) {
      process.nextTick(() => void this.#write(queue[i]));
    }
    this.#meta.get(channel).paused = false;
  }

  #write(logs, channel) {
    if (this.#closed) return;
    const stream = this.#streams.get(channel) ?? this.#open(channel);
    const paused = this.#meta.get(channel).paused;
    if (!stream || !stream.writable || stream.writableCorked || paused) {
      return void this.#queues[channel].push(logs);
    }
    try {
      const writable = stream.write(this.#stringify(logs), "utf-8");
      if (!writable) {
        this.#meta.get(channel).paused = true;
        stream.once("drain", () => this.#resume(channel));
      }
    } catch { }
  }

  #close(channel) {
    const stream = this.#streams.get(channel);
    if (!stream || stream.destroyed) return;
    this.#meta.get(channel).paused = true;
    this.#streams.delete(channel);
  }

  async *#readDir(dir, { from, to }) {
    const source = await fs.readdir(dir);
    for (let i = 0; i < source.length; i++) {
      const name = source[i];
      const matching = name.match(FILE_TS);
      if (!matching) continue;
      const time = parseInt(matching?.groups?.time, 10);
      if (!Number.isFinite(time) || !misc.inRange(time, from, to)) continue;
      yield name;
    }
  }

  close() {
    if (this.#closed) return;
    for (const channel of CHANNELS) this.#close(channel);
    const timers = this.#timers;
    for(const timer of timers.values()){
      clearTimeout(timer);
    }
    timers.clear();
    collection.delete(this.#dir);
    this.#closed = true;
  }

  cursor(channel, { from = 0, to = Infinity, encoding = "utf8" } = {}) {
    if (this.#closed) return;
    if (!CHANNELS.has(channel)) {
      throw new Error(`Incorrect channel ${channel}`);
    }
    const dir = path.resolve(this.#dir, channel);
    const names = this.#readDir(dir, { from, to });
    const self = this;
    return (async function* gen() {
      if (self.#closed) return;
      for await (const name of names) {
        yield fs.readFile(path.resolve(dir, name), { encoding });
      }
    })();
  }

  async delete(channel, { from = 0, to = Infinity } = {}) {
    if (this.#closed) return;
    const dir = path.resolve(this.#dir, channel);
    const names = this.#readDir(dir, { from, to });
    for await (const name of names) {
      console.log(name);
      await fs.unlink(path.resolve(dir, name));
    }
  }

  log(...logs) {
    this.#write(logs, "log");
  }

  error(...logs) {
    this.#write(logs, "error");
  }

  info(...logs) {
    this.#write(logs, "info");
  }

  warn(...logs) {
    this.#write(logs, "warn");
  }

  get closed() {
    return this.#closed;
  }
}

module.exports = LogBook;
