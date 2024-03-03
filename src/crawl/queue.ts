export interface AssetQueue {
  urls: Set<string>;
  queue: string[];

  enqueue(url: string): void;
  dequeue(): string | undefined;
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
};

export default assetQueue;
