// api/generate-audio.js

const fetch = require('node-fetch');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { speaker, dialogue, voice } = req.body;

    if (!speaker || !dialogue || !voice) {
        res.status(400).send('Missing parameters.');
        return;
    }

    try {
        const openai_api_key = process.env.OPENAI_API_KEY;

        // List of supported voices
        const supportedVoices = ['nova', 'shimmer', 'echo', 'onyx', 'fable', 'alloy'];

        if (!supportedVoices.includes(voice)) {
            console.error(`Unsupported voice: ${voice}.`);
            res.status(400).send(`Unsupported voice: ${voice}`);
            return;
        }

        // Clean dialogue by removing any text within brackets
        const cleanedDialogue = dialogue.replace(/\[(.*?)\]/g, '');

        // Construct the request payload
        const requestBody = {
            model: 'tts-1',
            input: cleanedDialogue,
            voice: voice,
            response_format: 'mp3'
        };

        // Make the API request to OpenAI's TTS endpoint
        const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openai_api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!ttsResponse.ok) {
            const error = await ttsResponse.json();
            console.error('TTS API Error:', error);
            res.status(500).send('Error generating audio.');
            return;
        }

        const audioData = await ttsResponse.buffer();

        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(audioData);
    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).send('Server error.');
    }
};
