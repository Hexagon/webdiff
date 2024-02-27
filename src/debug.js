class DebugSingleton {
  static _instance = null; // Static member to hold the instance

  constructor() {
    if (DebugSingleton._instance) {
      return DebugSingleton._instance; // Return existing instance if already created
    }
    this.enabled = false;
    DebugSingleton._instance = this;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  log(...args) {
    if (this.enabled) {
      console.log("[DEBUG]:", ...args);
    }
  }
}

const Debug = new DebugSingleton();

export { Debug }; // Export a single instance
