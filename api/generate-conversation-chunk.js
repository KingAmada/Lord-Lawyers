const fetch = require('node-fetch');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        console.error('Invalid HTTP method:', req.method);
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const { topic, speakers, country, state, city, duration } = req.body;

        if (!topic || !speakers || speakers.length < 2 || !country) {
            console.error('Missing or invalid parameters:', req.body);
            res.status(400).send('Missing or invalid parameters.');
            return;
        }

        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

        if (!OPENAI_API_KEY) {
            console.error('Missing OpenAI API Key');
            res.status(500).send('Server misconfiguration: API key missing.');
            return;
        }

        console.log('Incoming request:', { topic, speakers, country, state, city, duration });

        const speakerDescriptions = speakers
            .map(s => `${s.name}, a ${s.level} lawyer, speaks with a voice resembling "${s.voice}".`)
            .join('\n');

        const jurisdiction = `${country}, ${state || ''}, ${city || ''}`.trim();

        const prompt = `
        You are to create a legal podcast conversation between the following lawyers:
        ${speakerDescriptions}

        They are discussing the topic: "${topic}".
        Jurisdiction: ${jurisdiction}.
        Approximate Duration: ${duration} minutes.

        Please generate a detailed, interactive, and dynamic conversation among these lawyers.
        `;

        console.log('Prompt sent to OpenAI:', prompt);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [{ role: 'system', content: prompt }],
                max_tokens: 800,
                temperature: 0.8
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('OpenAI API Error:', error);
            res.status(500).send(`OpenAI API Error: ${error.error.message}`);
            return;
        }

        const data = await response.json();
        console.log('OpenAI API Response:', data);

        res.status(200).json({ conversationText: data.choices[0].message.content.trim() });
    } catch (error) {
        console.error('Unexpected Server Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
