const puppeteer = require("puppeteer-extra");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function search(name, outputfile) {
  console.log("starting search");
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox"],
  });

  console.log("browser launched");

  const page = await browser.newPage();

  await page.goto(
    "https://bizfileonline.sos.ca.gov/search/business"
  );

  console.log("page loaded");

  // print out the first page title
  const title = await page.title();
  console.log("title", title);

  // wait three seconds to load
  await page.waitForTimeout(1000);

  // find the search bar (text input with class 'search-input')
  await page.type('.search-input', name);

  // Press the search button
  await page.click('.search-button'); // Replace with the actual selector of the search button

  // Wait for the search to complete
  await page.waitForTimeout(3000);

  // Find the table of search results and Parse the table (classes div-table center-container)
  const results = await page.$$eval('.div-table-row', rows => {
    return Array.from(rows, row => {
      const columns = row.querySelectorAll('td');
      return {
        entity: columns[0].innerText,
        initialFilingDate: columns[1].innerText,
        status: columns[2].innerText,
        entityType: columns[3].innerText,
        formedIn: columns[4].innerText,
        agent: columns[5].innerText
      };
    });
  });

  // Save the parsed output to a CSV file
  const csvWriter = createCsvWriter({
    path: outputfile,
    header: [
      { id: 'entity', title: 'ENTITY' },
      { id: 'initialFilingDate', title: 'INITIAL FILING DATE' },
      { id: 'status', title: 'STATUS' },
      { id: 'entityType', title: 'ENTITY TYPE' },
      { id: 'formedIn', title: 'FORMED IN' },
      { id: 'agent', title: 'AGENT' },
    ]
  });

  console.log('RESULTS', results)

  await csvWriter.writeRecords(results);

  await browser.close();
}

async function processFile(file) {
  const ext = path.extname(file);
  let lines = [];

  if (ext === '.txt') {
    const fileStream = fs.createReadStream(file);

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      lines.push(line);
    }
  } else if (ext === '.csv') {
    return new Promise((resolve, reject) => {
      fs.createReadStream(file)
        .pipe(csv())
        .on('data', (row) => {
          lines.push(row.ENTITY);
        })
        .on('end', () => {
          resolve(lines);
        })
        .on('error', reject);
    });
  } else {
    throw new Error("Unsupported file type");
  }

  // if output folder does not exist, create it
  if (!fs.existsSync('./output')) {
    fs.mkdirSync('./output');
  }

  for (const line of lines) {
    // Strip all non-alphanumeric characters and replace spaces with underscores
    const filename = line.replace(/\W/g, '_') + ".csv";
    await search(line, './output/' + filename);
  }
}

if (!process.argv[2]) {
  console.error('Please provide a file to process');
  return;
}

const inputArg = process.argv[2];
if (
  !inputArg.includes('.txt') &&
  !inputArg.includes('.csv')
) {
  console.log('Processing single entity', inputArg)
  search(inputArg, inputArg + '.csv');
  return
}


processFile(process.argv[2]);