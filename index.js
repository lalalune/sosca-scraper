const puppeteer = require("puppeteer-core");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const os = require('os');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

function getDefaultExecutablePath() {
  const platform = os.platform();

  switch (platform) {
    case 'darwin':
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    case 'win32':
      return 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
    case 'linux':
      return '/usr/bin/google-chrome';
    default:
      throw new Error('Unsupported platform: ' + platform);
  }
}

const executablePath = getDefaultExecutablePath();

let browser

// if output folder does not exist, create it
if (!fs.existsSync('./output')) {
  fs.mkdirSync('./output');
}

async function search(name, outputfile) {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"],
      executablePath
    });
  }

  const page = await browser.newPage();

  await page.goto(
    "https://bizfileonline.sos.ca.gov/search/business"
  );

  // wait three seconds to load
  await page.waitForTimeout(500);

  // find the search bar (text input with class 'search-input')
  await page.type('.search-input', name);

  // Press the search button
  await page.click('.search-button'); // Replace with the actual selector of the search button

  // Wait for the search to complete
  await page.waitForTimeout(4000);

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

  console.log('RESULTS')
  // for each object in the results array, print this formatted data:
  // entity name
  // initial filing date
  // status
  // entity type
  // formed in
  // agent
  results.forEach((result) => {
    console.log(result.entity)
    console.log(result.initialFilingDate)
    console.log(result.status)
    console.log(result.entityType)
    console.log(result.formedIn)
    console.log(result.agent)
    console.log('-------------------')
  })

  await csvWriter.writeRecords(results);

  console.log('The file was saved to', outputfile)

  await page.close();
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
    await new Promise((resolve, reject) => {
      fs.createReadStream(file)
        .pipe(csv())
        .on('data', (row) => {
          lines.push(row[0]);
        })
        .on('end', () => {
          resolve(lines);
        })
        .on('error', reject);
    });
  } else {
    throw new Error("Unsupported file type");
  }

  for (const line of lines) {
    // Strip all non-alphanumeric characters and replace spaces with underscores
    const filename = line.replace(/\W/g, '_') + ".csv";
    await search(line, './output/' + filename);
  }
}

const inputArg = process.argv[2];

if (!inputArg) {
  console.error('Please provide a file to process');
  browser?.close();
  process.exit(0);
  return;
}

if (
  !inputArg.includes('.txt') &&
  !inputArg.includes('.csv')
) {
  // join the values from process.argv[2] to the end of the array
  const input = process.argv.slice(2).join(' ');
  console.log('Looking up "' + input + '"')
  search(input, './output/' + input + '.csv').then(() => {
    browser?.close();
    process.exit(0);
  });
  return
}


processFile(process.argv[2]).then(() => {
  browser?.close();
  // exit the process
  process.exit(0);
})