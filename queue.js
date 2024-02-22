export const pageQueue = {
  urls: new Set(), // Using a Set to ensure unique URLs
  queue: [],

  enqueue(url) {
    if (!this.urls.has(url)) {
      this.urls.add(url);
      this.queue.push(url);
    }
  },

  dequeue() {
    return this.queue.shift();
  },
};
