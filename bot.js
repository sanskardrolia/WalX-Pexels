const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Get API keys from environment variables
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

// Validate Telegram token
if (!TELEGRAM_TOKEN) {
    throw new Error('Telegram Bot Token not provided! Please set TELEGRAM_TOKEN environment variable.');
}

if (!PEXELS_API_KEY) {
    throw new Error('Pexels API Key not provided! Please set PEXELS_API_KEY environment variable.');
}

// Create bot instance
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Pexels API configuration
const pexelsClient = axios.create({
    baseURL: 'https://api.pexels.com/v1/',
    headers: {
        Authorization: PEXELS_API_KEY
    }
});

// Store last used photo indices per chat to avoid repetition
const lastIndices = new Map();

async function getWallpaper(chatId, searchQuery = 'dark car') {
    try {
        // First attempt with the exact search query
        let response = await pexelsClient.get('search', {
            params: {
                query: searchQuery,
                per_page: 80,
                orientation: 'portrait'
            }
        });

        let photos = response.data.photos;
        // If no results, try a broader search by splitting terms
        if (!photos || photos.length === 0) {
            const fallbackQuery = searchQuery.split(' ')[0]; // Use first word as fallback
            response = await pexelsClient.get('search', {
                params: {
                    query: fallbackQuery,
                    per_page: 80,
                    orientation: 'portrait'
                }
            });
            photos = response.data.photos;
        }

        if (!photos || photos.length === 0) {
            throw new Error('No wallpapers found');
        }

        // Get a random photo different from the last one for this chat
        const lastIndex = lastIndices.get(chatId) || -1;
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * photos.length);
        } while (newIndex === lastIndex && photos.length > 1);

        lastIndices.set(chatId, newIndex);
        return photos[newIndex].src.large;
    } catch (error) {
        console.error('Error fetching wallpaper:', error);
        throw error;
    }
}

// Handle "new wal" command
bot.onText(/new wal/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        bot.sendMessage(chatId, 'Fetching a new dark car wallpaper...');
        const wallpaperUrl = await getWallpaper(chatId, 'dark car');
        await bot.sendPhoto(chatId, wallpaperUrl, {
            caption: 'Here\'s your dark car wallpaper!'
        });
    } catch (error) {
        bot.sendMessage(chatId, 'Sorry, couldn\'t fetch a wallpaper right now. Try again later!');
    }
});

// Handle /search command
bot.onText(/\/search (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const searchTerm = match[1].trim();
    
    try {
        bot.sendMessage(chatId, `Searching for "${searchTerm}" wallpaper...`);
        const wallpaperUrl = await getWallpaper(chatId, searchTerm);
        await bot.sendPhoto(chatId, wallpaperUrl, {
            caption: `Here's a wallpaper matching "${searchTerm}"!`
        });
    } catch (error) {
        bot.sendMessage(chatId, `Sorry, couldn\'t find any wallpapers for "${searchTerm}". Try a different term!`);
    }
});

// Handle "ping" to keep Render awake
bot.onText(/ping/, (msg) => {
    // Do nothing - just keeps the bot active
});

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Welcome! 
- Send "new wal" for a dark car wallpaper
- Use "/search [term]" to search for any wallpaper (e.g., "/search sunset beach")`);
});

// Log when bot starts
console.log('Bot is running...');