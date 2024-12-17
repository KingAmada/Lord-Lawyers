// index.js

const express = require('express');
const bodyParser = require('body-parser');
const generateConversation = require('./api/generate-conversation');
const generateAudio = require('./api/generate-audio');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(bodyParser.json());

// Define API routes
app.post('/api/generate-conversation', generateConversation);
app.post('/api/generate-audio', generateAudio);

// Root endpoint for testing
app.get('/', (req, res) => {
    res.send('Podcast Generator API is running.');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
