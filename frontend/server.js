const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || "http://localhost:5000";

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.get("/", async (req, res) => {
  try {
    const items = await (await fetch(`${API_URL}/menu`)).json();
    const rows = items.map((i) => `<li>${i.name} - Rs ${i.price}</li>`).join("");
    res.send(`<h1>BrewCart Menu</h1><ul>${rows}</ul>`);
  } catch (err) {
    res.status(502).send("Menu service unavailable");
  }
});

app.listen(PORT, () => console.log(`BrewCart frontend on port ${PORT}`));
