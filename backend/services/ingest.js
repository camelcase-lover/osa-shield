
import axios from "axios";
import csv from "csv-parser";
import { createClient } from "redis";
import { normalize } from "../utils/normalize.js";
import { hash } from "../utils/sha256.js";

const client = createClient();
await client.connect();

const URL_SET = "phish:urls";
const DOMAIN_SET = "phish:domains";

async function ingest() {
  console.log("Downloading from URLhaus...");

  const res = await axios.get(
    "https://urlhaus.abuse.ch/downloads/csv_online/",
    { responseType: "stream" }
  );

  const pipeline = client.multi();
  let count = 0;

  await new Promise((resolve, reject) => {
  
     res.data .pipe(
  csv({
    skipLines: 9,
    headers: [
      "id",
      "dateadded",
      "url",
      "url_status",
      "last_online",
      "threat",
      "tags",
      "urlhaus_link",
      "reporter",
    ],
  })
)
      .on("data", (row) => {
        const url = row.url;

        if (!url || url.startsWith("#")) return;

        const norm = normalize(url);
        if (!norm) return;

        pipeline.sAdd(URL_SET, hash(norm.full));
        pipeline.sAdd(DOMAIN_SET, norm.domain);

        count++;
      })
      .on("end", resolve)
      .on("error", reject);
  });

  await pipeline.exec();

  console.log(`Ingested ${count} entries`);
  process.exit(0);
}

ingest();