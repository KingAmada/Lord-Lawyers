const express = require('express');
const bodyParser = require('body-parser');
const generateConversation = require('./api/generate-conversation-chunk');
const generateAudio = require('./api/generate-audio');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for any unmatched routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware to parse JSON
app.use(bodyParser.json());

// Define API routes
app.post('/api/generate-conversation-chunk', generateConversation);
app.post('/api/generate-audio', generateAudio);

// Root endpoint for testing
app.get('/', (req, res) => {
    res.send('Podcast Generator API is running.');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
