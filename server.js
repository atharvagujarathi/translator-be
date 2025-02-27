const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

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

// Function to translate text in chunks
const translateTextInChunks = async (text) => {
  const chunks = text
    .split(/[।\n]+\s*/)
    .filter((sentence) => sentence.trim() !== "");
  const translationRequests = chunks.map((chunk) =>
    axios
      .post("https://translator-python.onrender.com/translate", {
        q: chunk + "।",
        source: "hi",
        target: "ta",
      })
      .then((response) => {
        if (response.data && response.data.translatedText) {
          return {
            original: chunk + "।",
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

// Fetch & Translate Murli Content
app.get("/fetch-and-translate", async (req, res) => {
  const date = req.query.date || "2025-02-27"; // Default date if not provided
  const murliUrl = `https://madhubanmurli.org/murlis/hi/html/murli-${date}.html`;

  try {
    const response = await axios.get(murliUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }, // Bypass bot detection
    });

    const $ = cheerio.load(response.data);

    // Extract Hindi text from relevant classes
    const hindiText = $(".lang-hi, .essence-txt")
      .map((_, el) => $(el).text().trim())
      .get()
      .join(" ");

    if (!hindiText) {
      return res.status(404).send("Murli content not found.");
    }

    console.log("Extracted Hindi Text:", hindiText);

    // Translate the extracted text
    const translatedPairs = await translateTextInChunks(hindiText);
    res.json({ pairs: translatedPairs });
  } catch (error) {
    console.error("Error fetching Murli:", error.message);
    res.status(500).send("Failed to fetch or translate the Murli.");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
