const express = require('express');
const cheerio = require('cheerio');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/scrape', async (req, res) => {
  const { company } = req.query;

  if (!company) {
    return res.status(400).json({ error: 'Company parameter is required.' });
  }

  let browser = null;
  try {
    const query = encodeURIComponent(`${company} Jobs`);
    const url = `https://www.glassdoor.com.br/Job/jobs.htm?sc.keyword=${query}`;
    
    // Launch a headless browser instance using the provided Chromium
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
  // 1. Go to the URL and wait for the basic document to load
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 2. Explicitly wait for the job listing selector to appear on the page
    // This is the most reliable way to know the content is ready.
    // We give it up to 25 seconds to appear after the initial page load.
    const jobListingSelector = 'li.react-job-listing'; // Make sure this is still correct!
    await page.waitForSelector(jobListingSelector, { timeout: 25000 });
    
    // 3. Get the final page content
    const content = await page.content();
    
    const $ = cheerio.load(content);
    const jobs = [];

    // You may need to update this selector again!
    $('li.react-job-listing').each((i, el) => {
      const titleEl = $(el).find('a[data-test="job-title"]');
      const locationEl = $(el).find('div[data-test="location"]');
      
      if (titleEl.length && locationEl.length) {
        jobs.push({
          title: titleEl.text().trim(),
          location: locationEl.text().trim(),
          link: new URL(titleEl.attr('href'), 'https://www.glassdoor.com.br').href
        });
      }
    });

    if (jobs.length === 0) {
      console.log("No jobs found. The page might be blocked or the selector is wrong.");
    }

    res.json({ jobs });

  } catch (error) {
    console.error("Error during scraping with Puppeteer:", error);
    res.status(500).json({ error: 'Failed to scrape Glassdoor. The site may be actively blocking automated access.' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Scraping server with Puppeteer listening on port ${PORT}`);
});