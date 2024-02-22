import { pageQueue } from "./queue.js";
import { Page } from "./page.js";
import { delay } from "./utils.js";
import { Debug } from "./debug.js";

const delayMs = 100;
const debug = true;
const target = "https://hexagon.56k.guru";
const outputDirectory = "./output";

// Enable debugging if requested
if (debug) {
  Debug.enable();
}

Debug.log("Debugging is on!");

pageQueue.enqueue(target);

async function processQueue() {
  while (pageQueue.queue.length > 0) {
    const url = pageQueue.dequeue();
    const page = new Page(url, outputDirectory);

    try {
      await page.fetchAndParse();
      // Find, filter, and enqueue new links
      page.links.forEach((link) => {
        if (link) { // Ensure the link has an href attribute
          try {
            const resolvedUrl = new URL(link, url); // Resolve against the current page
            if (shouldEnqueue(resolvedUrl)) { // Apply your filtering logic
              pageQueue.enqueue(resolvedUrl.toString());
            }
          } catch (error) {
            Debug.log("Error processing link:", link, error);
          }
        }
      });
      await page.save(outputDirectory); // Save the page
    } catch (error) {
      console.error(error);
    } finally {
      await delay(delayMs);
    }

    Debug.log(
      "Queue Status: Length:",
      pageQueue.queue.length,
      " Next:",
      pageQueue.queue[0],
    );
  }
}

function shouldEnqueue(url) {
  // 2. Remove anchor information
  url.hash = ""; // Reset the hash (anchor) part

  // 3. Additional filtering (your existing logic)
  if (url.hostname === new URL(target).hostname) {
    return url.toString();
  } else {
    return undefined;
  }
}

processQueue();
