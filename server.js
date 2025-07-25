const express = require('express');
const cheerio = require('cheerio');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Puppeteer requires special arguments to run on Render
const puppeteerOptions = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--single-process'
  ],
};

app.get('/scrape', async (req, res) => {
  const { company } = req.query;

  if (!company) {
    return res.status(400).json({ error: 'Company parameter is required.' });
  }

  let browser = null;
  try {
    const query = encodeURIComponent(`${company} Jobs`);
    const url = `https://www.glassdoor.com.br/Job/jobs.htm?sc.keyword=${query}`;
    
    // Launch a headless browser instance
    browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();

    // Set a realistic User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
    
    // Go to the URL and wait for the page to fully load
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Get the final page content after any Cloudflare checks
    const content = await page.content();
    
    // Now use Cheerio to parse the final HTML
    const $ = cheerio.load(content);
    const jobs = [];

    // IMPORTANT: Verify this selector is still correct!
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
    
    // If no jobs were found, it's possible a CAPTCHA or block page is still present
    if (jobs.length === 0) {
      console.log("No jobs found. The page might be blocked or the selector is wrong.");
      // You could even save a screenshot for debugging
      // await page.screenshot({ path: 'debug_screenshot.png' });
    }

    res.json({ jobs });

  } catch (error) {
    console.error("Error during scraping with Puppeteer:", error);
    res.status(500).json({ error: 'Failed to scrape Glassdoor. The site may be actively blocking automated access.' });
  } finally {
    // Ensure the browser is always closed
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Scraping server with Puppeteer listening on port ${PORT}`);
});