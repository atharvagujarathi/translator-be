const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { chromium } = require("playwright");

process.env.PLAYWRIGHT_BROWSERS_PATH = "/tmp/playwright-browsers";

const app = express();
const PORT = process.env.PORT || 3000;

// CORS setup
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());

const chunkText = (text) => {
  return text.split(/[।\n]+\s*/).filter((sentence) => sentence.trim() !== "");
};

const translateTextInChunks = async (text) => {
  const chunks = chunkText(text);
  const translationRequests = chunks.map((chunk) =>
    axios
      .post("https://translator-python.onrender.com/translate", {
        q: chunk + "।",
        source: "hi",
        target: "ta",
      })
      .then((response) => {
        if (response.data && response.data.translatedText) {
          console.log("Translated:", response.data.translatedText);
          return {
            original: chunk + "。",
            translated: response.data.translatedText,
          };
        } else {
          throw new Error("Translation failed. No translated text received.");
        }
      })
      .catch((error) => {
        console.error("Error translating chunk:", error.message);
        return null;
      })
  );

  const translatedPairs = await Promise.all(translationRequests);
  return translatedPairs.filter((pair) => pair !== null);
};

app.get("/fetch-and-translate", async (req, res) => {
  console.log("Received request on /fetch-and-translate");

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    console.log("Navigating to the website...");
    await page.goto("https://madhubanmurli.org/#", {
      waitUntil: "networkidle",
    });

    console.log("Waiting for content to load...");
    await page.waitForSelector(".lang-hi", { timeout: 10000 });

    const hindiText = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".lang-hi"))
        .map((el) => el.innerText.trim())
        .join(" ");
    });

    await browser.close();

    console.log("Extracted Hindi Text:", hindiText);

    if (!hindiText) {
      return res.status(404).send("Content not found on the site.");
    }

    const translatedPairs = await translateTextInChunks(hindiText);

    console.log("Translated Pairs:", translatedPairs);

    res.json({ pairs: translatedPairs });
  } catch (error) {
    console.error("Error fetching or translating content:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
