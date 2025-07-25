// server.js - A simple Express server
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors'); // To allow requests from your extension

const app = express();
const PORT = process.env.PORT || 3000;

// Use CORS to allow your chrome extension origin to make requests
app.use(cors()); 

app.get('/scrape', async (req, res) => {
  const { company } = req.query;

  if (!company) {
    return res.status(400).json({ error: 'Company parameter is required.' });
  }

  try {
    const query = encodeURIComponent(`${company} Jobs`);
    const url = `https://www.glassdoor.com.br/Job/jobs.htm?sc.keyword=${query}`;
    
    // The server makes the request, not the browser extension
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(data);
    const jobs = [];

    // This selector must be updated by inspecting the Glassdoor page
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

    res.json({ jobs });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to scrape Glassdoor.' });
  }
});

app.listen(PORT, () => {
  console.log(`Scraping server listening on port ${PORT}`);
});