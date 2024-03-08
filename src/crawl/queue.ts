export interface AssetQueue {
  urls: Set<string>;
  queue: string[];

  enqueue(url: string): void;
  dequeue(): string | undefined;

  get(): string[];
  set(queue: string[]): void;
}

const assetQueue: AssetQueue = {
  urls: new Set(),
  queue: [],

  enqueue(url: string) {
    if (!this.urls.has(url)) {
      this.urls.add(url);
      this.queue.push(url);
    }
  },

  dequeue() {
    return this.queue.shift();
  },

  get() {
    return this.queue;
  },

  set(queue: string[]) {
    this.queue = queue;
  },
};

export default assetQueue;
