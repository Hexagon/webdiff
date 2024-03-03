import { colors, tty } from "cliffy/ansi/mod.ts";

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
    console.error(colors.red(error.message));
  }

  log(status: string) {
    console.log(status);
  }

  debug(args: string) {
    if (this.verboseOutput) this.log(colors.gray(args));
  }

  errorFeed(error: Error) {
    tty.cursorLeft();
    tty.cursorUp();
    tty.eraseDown();
    console.error(colors.red(error.message));
    console.error("");
  }

  logFeed(status: string) {
    tty.cursorLeft();
    tty.cursorUp();
    tty.eraseDown();
    console.log(status);
  }

  debugFeed(args: string) {
    if (this.verboseOutput) {
      tty.cursorLeft();
      tty.cursorUp();
      tty.eraseDown();
      this.log(colors.gray(args));
      console.error("");
    }
  }
}

const Debug = new DebugSingleton();
export { Debug };
