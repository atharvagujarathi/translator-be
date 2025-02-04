const express = require("express");
const puppeteer = require("puppeteer");
const axios = require("axios");

const app = express();
const PORT = 3000;
process.env.PUPPETEER_CACHE_DIR = "/opt/render/.cache/puppeteer";

app.use(express.json());

const chunkText = (text) => {
  return text.split(/[।\n]+\s*/).filter((sentence) => sentence.trim() !== "");
};

const translateTextInChunks = async (text) => {
  const chunks = chunkText(text);
  const translationRequests = chunks.map((chunk) => {
    return fetch("http://127.0.0.1:8080/translate", {
      method: "POST",
      body: JSON.stringify({
        q: chunk + "।",
        source: "hi",
        target: "ta",
        format: "text",
      }),
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Translation API failed: ${response.status}`);
        }
        return response.json();
      })
      .then((translatedData) => {
        if (translatedData && translatedData.translatedText) {
          return {
            original: chunk + "।",
            translated: translatedData.translatedText,
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
    const browser = await puppeteer.launch({
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
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
