const puppeteer = require("puppeteer-extra");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const example = '1 HOTEL SF LLC'

async function search (name, outputfile) {
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
    path: 'output.csv',
    header: [
      {id: 'entity', title: 'ENTITY'},
      {id: 'initialFilingDate', title: 'INITIAL FILING DATE'},
      {id: 'status', title: 'STATUS'},
      {id: 'entityType', title: 'ENTITY TYPE'},
      {id: 'formedIn', title: 'FORMED IN'},
      {id: 'agent', title: 'AGENT'},
    ]
  });

  console.log('RESULTS', results)

  await csvWriter.writeRecords(results);

  await browser.close();
}

search(example, 'example.csv')