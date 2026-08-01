import fetch from "node-fetch";

const API_KEY = "mb_Cw0i6dFvwAo8HZFOj/UDXW5AA4Sw5g2Svz7DQqyL5CA=";
const url = "https://clickhouse.eatfit.in/api/card/1847/query/json";

const payload = {
  parameters: [
    { type: "date/single", target: ["variable", ["template-tag", "s"]], value: "2026-07-01" },
    { type: "date/single", target: ["variable", ["template-tag", "e"]], value: "2026-07-19" },
    { type: "category", target: ["variable", ["template-tag", "Brand"]], value: "Cakezone" }
  ]
};

async function test() {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log("Success!", data.length ? `Got ${data.length} rows` : data);
      if (data.length > 0) {
        console.log("Sample Row:", data[0]);
      }
    } else {
      console.log("Failed:", res.status);
      const text = await res.text();
      console.log(text);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
