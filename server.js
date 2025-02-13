const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { chromium } = require("playwright");

const app = express();
const PORT = 3000;

app.use(
  cors({
    origin: ["http://localhost:4200"],
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
  const translationRequests = chunks.map((chunk) => {
    return axios
      .post("https://translator-python.onrender.com/translate", {
        q: chunk + "।",
        source: "hi",
        target: "ta",
      })
      .then((response) => {
        if (response.data && response.data.translatedText) {
          console.log("rere", response.data.translatedText);

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
      });
  });

  const translatedPairs = await Promise.all(translationRequests);
  return translatedPairs.filter((pair) => pair !== null);
};

app.get("/fetch-and-translate", async (req, res) => {
  console.log("Received request on /fetch-and-translate");
  try {
    const browser = await chromium.launch({
      headless: true,
    });

    const page = await browser.newPage();
    await page.goto("https://madhubanmurli.org/#", {
      waitUntil: "domcontentloaded",
    });

    console.log("Before extracting Hindi text");
    const hindiText = await page.evaluate(async () => {
      await new Promise((resolve) => {
        const interval = setInterval(() => {
          if (document.querySelector(".lang-hi")) {
            clearInterval(interval);
            resolve();
          }
        }, 500);
      });

      const elements = document.querySelectorAll(".lang-hi");
      let formattedText = "";

      elements.forEach((element) => {
        formattedText += element.innerText + " ";
      });

      return formattedText.trim();
    });

    console.log("Extracted Hindi Text:", hindiText);

    if (!hindiText.trim()) {
      await browser.close();
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
