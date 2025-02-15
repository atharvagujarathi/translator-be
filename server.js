const express = require("express");
const axios = require("axios");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
const PORT = 3000;

app.use(cors());
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
      .then((response) => ({
        original: chunk + "。",
        translated: response.data.translatedText,
      }))
      .catch((error) => {
        console.error("Translation error:", error.message);
        return null;
      })
  );

  const translatedPairs = await Promise.all(translationRequests);
  return translatedPairs.filter((pair) => pair !== null);
};

app.get("/fetch-and-translate", async (req, res) => {
  console.log("Received request on /fetch-and-translate");
  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto("https://madhubanmurli.org/#", {
      waitUntil: "domcontentloaded",
    });

    console.log("Before extracting Hindi text");
    const hindiText = await page.evaluate(() => {
      const elements = document.querySelectorAll(".lang-hi");
      return Array.from(elements)
        .map((el) => el.innerText)
        .join(" ");
    });

    console.log("Extracted Hindi Text:", hindiText);

    if (!hindiText.trim()) {
      await browser.close();
      return res.status(404).send("Content not found.");
    }

    const translatedPairs = await translateTextInChunks(hindiText);
    await browser.close();

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
