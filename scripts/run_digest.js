// scripts/run_digest.js

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch'); 
const { Resend } = require('resend');

// --- Configuration & Initialization ---
// These variables are now confirmed to be loaded by the 'cross-env node -r dotenv/config' wrapper.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!SUPABASE_SERVICE_KEY || !FINNHUB_API_KEY || !RESEND_API_KEY) {
    // This check should now pass, as dotenv/config successfully loaded the variables.
    console.error("FATAL ERROR: Missing required environment variables. Please check the contents of your .env.local file.");
    process.exit(1);
}

// 1. Initialize Clients (Admin client uses the SECRET key to bypass RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
});
const resend = new Resend(RESEND_API_KEY);

// --- HELPER FUNCTION: Email Template ---
function buildEmailHtml(userName, digestData) {
    let content = `
        <body style="font-family: sans-serif; padding: 20px; background-color: #f4f4f9;">
            <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                <h1 style="color: #1e40af;">Hello ${userName}, Your Friday Recap is Here! 🔔</h1>
                <p style="color: #4b5563;">A curated summary of your holdings and watchlist for the week.</p>
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    `;

    for (const [ticker, data] of Object.entries(digestData)) {
        content += `
            <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #d1d5db; border-radius: 6px; background-color: #f9f9f9;">
                <h2 style="font-size: 1.5rem; color: #1f2937; margin-top: 0;">${ticker}</h2>
                <p><strong>Friday Closing Price:</strong> <span style="font-weight: bold; color: #10b981;">$${data.closePrice}</span></p>
                <p style="margin-top: 5px;"><strong>Weekly High:</strong> $${data.weeklyHigh}</p>
                <p><strong>Weekly Low:</strong> $${data.weeklyLow}</p>
                <p style="margin-top: 10px;"><strong>Top News:</strong> ${data.news[0].headline}</p>
            </div>
        `;
    }
    
    content += `
            <p style="font-size: 0.8rem; color: #9ca3af; margin-top: 30px;">
                Disclaimer: This email is for informational purposes only.
            </p>
            </div>
        </body>
    `;
    return content;
}

// --- Main Execution Function ---
async function generateWeeklyDigest() {
    console.log("--- Starting Weekly Digest Generation ---");

    // --- A. Get All Users and Their Stocks ---
    const { data: stocks, error: stockError } = await supabaseAdmin
        .from('user_stocks')
        .select(`
            ticker, 
            user_id, 
            profiles:user_id (email)
        `); 

    if (stockError) return console.error("Error fetching tickers and users:", stockError);

    const userStocksMap = {}; 
    const uniqueTickers = new Set(); 

    stocks.forEach(stock => {
        const email = stock.profiles ? stock.profiles.email : null; 
        const user_id = stock.user_id;
        
        if (!email) return;

        if (!userStocksMap[user_id]) {
            userStocksMap[user_id] = { email: email, stocks: [] }; 
        }
        userStocksMap[user_id].stocks.push(stock.ticker);
        uniqueTickers.add(stock.ticker);
    });

    console.log(`Found ${uniqueTickers.size} unique stocks for ${Object.keys(userStocksMap).length} users.`);

    // --- B. Fetch Data from Finnhub (Batch Processing) ---
    const stockDataCache = {};
    const tickersArray = [...uniqueTickers];

    // Set time boundaries for historical data (last 7 days)
    const to = Math.floor(Date.now() / 1000);
    const from = to - (7 * 24 * 60 * 60); 

    for (let i = 0; i < tickersArray.length; i++) {
        const ticker = tickersArray[i];
        
        const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`;
        const candleUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
        const newsUrl = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
        
        try {
            const [quoteResponse, candleResponse, newsResponse] = await Promise.all([
                fetch(quoteUrl).then(res => res.json()),
                fetch(candleUrl).then(res => res.json()),
                fetch(newsUrl).then(res => res.json())
            ]);

            // Calculate Weekly High and Low
            const weeklyHigh = candleResponse.h ? Math.max(...candleResponse.h) : quoteResponse.h;
            const weeklyLow = candleResponse.l ? Math.min(...candleResponse.l) : quoteResponse.l;
            
            stockDataCache[ticker] = {
                closePrice: quoteResponse.c ? quoteResponse.c.toFixed(2) : 'N/A',
                weeklyHigh: weeklyHigh ? weeklyHigh.toFixed(2) : 'N/A',
                weeklyLow: weeklyLow ? weeklyLow.toFixed(2) : 'N/A',
                news: newsResponse && newsResponse.length > 0 ? newsResponse.slice(0, 1) : [{ headline: `No significant news found.` }]
            };

            // Enforce a delay to respect Finnhub's free tier rate limit
            await new Promise(resolve => setTimeout(resolve, 1000)); 
            
        } catch (error) {
            console.error(`Error processing ${ticker}:`, error.message);
        }
    }
    
    // --- C. Dispatch Emails to Users ---
    console.log("--- Data collection complete. Dispatching emails. ---");
    
    for (const user_id in userStocksMap) {
        const { email, stocks: userTickers } = userStocksMap[user_id];
        
        // 1. Filter the cached data for only this user's stocks
        const userDigestData = {};
        userTickers.forEach(ticker => {
            if (stockDataCache[ticker]) {
                userDigestData[ticker] = stockDataCache[ticker];
            }
        });
        
        if (Object.keys(userDigestData).length === 0) continue; 

        const htmlContent = buildEmailHtml(email, userDigestData); 

        // 2. Send via Resend (Using the verified test domain)
        try {
            await resend.emails.send({
                from: 'Recap Team <onboarding@resend.dev>', // Use the RESEND TEST DOMAIN
                to: [email], 
                subject: `Your Friday Stock Market Recap - ${new Date().toLocaleDateString('en-US', {weekday: 'long', month: 'short', day: 'numeric'})}`,
                html: htmlContent,
            });

            console.log(`Successfully dispatched email to ${email}.`);

        } catch (e) {
            console.error(`Resend API failed for ${email}:`, e);
        }
    }

    console.log("--- All email dispatch attempts finished. ---");
}

generateWeeklyDigest();