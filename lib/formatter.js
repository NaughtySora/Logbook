"use strict";

const {
  reflection: { isPrimitive, isError, isArray },
  abstract: { factorify },
  misc: { id },
} = require("naughty-util");

const LAST_COMMA = /,$/;

const TYPES = (() => {
  const types = ["boolean", "string", "number",
    "bigint", "symbol", "object", "undefined",
    "function", "null",
  ];
  return class {
    static {
      for (const type of types) {
        Object.defineProperty(
          this,
          type,
          { get() { return type; } }
        );
      }
    }
  }
})();

const trimLastComma = string => string.trim().replace(LAST_COMMA, "");

const formatPrimitive = value => {
  if (typeof value === TYPES.bigint) return `${value}n`;
  if (typeof value === TYPES.symbol) return value.toString();
  if (typeof value === TYPES.undefined) return TYPES.undefined;
  return value;
};

const formatComplex = value => {
  if (typeof value === TYPES.function) return TYPES.function;
  if (value === null) return TYPES.null;
  if ("toJSON" in value) return JSON.stringify(value);
  if (Array.isArray(value)) return formatArray(value);
  if (isError(value)) return value?.stack ?? "Error, empty stack";
  if (Object.getPrototypeOf(value).constructor === Object) {
    return formatObject(value);
  }
  if ("entries" in value && Symbol.iterator in value) {
    return formatEntries(value.entries());
  }
  return "{}";
};

const formatArray = array => {
  let result = "";
  for (const value of array) {
    result += `${formatter(value)}, `;
  }
  return `[${trimLastComma(result)}]`;
};

const formatObject = value => {
  let result = "";
  for (const entries of Object.entries(value)) {
    result += `${entries[0]}: ${formatter(entries[1])}, `;
  }
  return `{${trimLastComma(result)}}`;
};

const formatEntries = entries => {
  let result = "";
  for (const entry of entries) {
    result += `[${formatter(entry[0])}, ${formatter(entry[1])}], `;
  }
  return `[${trimLastComma(result)}]`;
};

const formatter = (value) => isPrimitive(value) ?
  formatPrimitive(value) :
  formatComplex(value);

module.exports = formatter;
