type Channels = Array<"log" | "error" | "info" | "warn">;
type Channel = Channels[number];

interface QueryOptions {
  from?: number;
  to?: number;
}

interface LogBookOptions {
  dir: string;
  rotation?: number;
}

export class LogBook {
  constructor(options: LogBookOptions);
  cursor(name: Channel, query?: QueryOptions): AsyncGenerator<Buffer<ArrayBufferLike> & string>;
  delete(name: Channel, query?: QueryOptions): Promise<string[]>;
  log(...logs: any[]): void;
  error(...logs: any[]): void;
  info(...logs: any[]): void;
  warn(...logs: any[]): void;
  close(): void;
  closed: boolean;
}
