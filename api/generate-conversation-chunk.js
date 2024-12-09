const fetch = require('node-fetch');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const { topic, speakers, country, state, city, duration } = req.body;

        if (!topic || !speakers || speakers.length < 2 || !country) {
            res.status(400).send('Missing or invalid parameters.');
            return;
        }

        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

        // Validate API key
        if (!OPENAI_API_KEY) {
            console.error('Missing OpenAI API Key');
            res.status(500).send('Server misconfiguration: API key missing.');
            return;
        }

        // Construct speaker descriptions and prompt
        const speakerDescriptions = speakers.map(speaker => 
            `${speaker.name}, a ${speaker.level} lawyer, speaks with a voice resembling "${speaker.voice}".`
        ).join('\n');

        const jurisdiction = `${country}, ${state || ''}, ${city || ''}`.trim();
        const prompt = `
        You are to create a legal podcast conversation between the following lawyers:

        ${speakerDescriptions}

        They are discussing the topic: "${topic}".

        Conversation details:
        - Reflect the legal expertise of each lawyer.
        - Include laws relevant to ${jurisdiction}.
        - Make the discussion interactive and realistic.
        - Conclude after approximately ${duration} minutes.
        `;

        // Make the API call
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [{ role: 'system', content: prompt }],
                max_tokens: 1000,
                temperature: 0.8
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('OpenAI API Error:', error);
            res.status(500).send(`Error: ${error.error.message}`);
            return;
        }

        const data = await response.json();
        res.status(200).json({ conversationText: data.choices[0].message.content.trim() });
    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
