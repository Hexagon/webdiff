import { colors, tty } from "cliffy/ansi/mod.ts";

class DebugSingleton { // We're keeping the singleton logic for now
  static _instance = null;

  constructor() {
    if (DebugSingleton._instance) {
      return DebugSingleton._instance;
    }
    this.verboseOuput = false;
    DebugSingleton._instance = this;
  }

  verbose() {
    this.verboseOuput = true;
  }

  error(error) {
    console.error(colors.red(error.message));
  }

  log(status) {
    console.log(status);
  }

  debug(args) {
    if (this.verboseOuput) this.log(colors.gray(args));
  }

  // Integrate the new functions with styling
  errorFeed(error) {
    tty.cursorLeft().cursorUp().eraseDown();
    console.error(colors.red(error.message));
    console.error("");
  }

  logFeed(status) {
    tty.cursorLeft().cursorUp().eraseDown();
    console.log(status);
  }

  debugFeed(args) {
    if (this.verboseOuput) {
      tty.cursorLeft().cursorUp().eraseDown();
      this.log(colors.gray(args));
      console.error("");
    }
  }
}

const Debug = new DebugSingleton();
export { Debug };
