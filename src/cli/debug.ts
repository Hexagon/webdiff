import { Colors, Cursor } from "@cross/utils";

class DebugSingleton {
  static _instance: DebugSingleton | null = null;

  private verboseOutput = false;

  constructor() {
    if (DebugSingleton._instance) {
      return DebugSingleton._instance;
    }
    this.verboseOutput = false;
    DebugSingleton._instance = this;
  }

  verbose() {
    this.verboseOutput = true;
  }

  error(error: Error) {
    console.error(Colors.red(error.message));
  }

  log(status: string) {
    console.log(status);
  }

  debug(args: string) {
    if (this.verboseOutput) this.log(Colors.dim(args));
  }

  errorFeed(error: Error) {
    console.log(Cursor.up() + Cursor.clearLine() + Colors.red(error.message));
    console.error("");
  }

  logFeed(status: string) {
    console.log(Cursor.up() + Cursor.clearLine() + status);
  }

  debugFeed(args: string) {
    if (this.verboseOutput) {
      console.log(Cursor.up() + Cursor.clearLine() + Colors.dim(args));
      console.error("");
    }
  }
}

const Debug = new DebugSingleton();
export { Debug };
