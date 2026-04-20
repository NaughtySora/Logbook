# LogBook

Simple filesystem logger with minimal console interface.
Based on fs streams, built-in rotation, graceful closing.
Small api for managing rotated logs.

## Example

```js
  const DAY = 24 * 60 * 60 * 1000;
  const logger = await new LogBook({ dir: "./logs", rotation: DAY });
  logger.error(new Error("Error message"));
  logger.log("Something happen");
  logger.close();
```
