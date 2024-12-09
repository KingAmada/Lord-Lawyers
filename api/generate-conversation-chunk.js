const fetch = require('node-fetch');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const {
            topic,
            speakers,
            country,
            state,
            city,
            previousLines,
            linesPerChunk,
            isFirstChunk,
            isLastChunk
        } = req.body;

        if (!topic || !speakers || speakers.length < 2 || !country || !linesPerChunk) {
            res.status(400).send('Missing or invalid parameters.');
            return;
        }

        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

        if (!OPENAI_API_KEY) {
            console.error('Missing OpenAI API Key');
            res.status(500).send('Server misconfiguration: API key missing.');
            return;
        }

        // Construct speaker descriptions
        const speakerDescriptions = speakers
            .map(s => `${s.name}, a ${s.level} lawyer, speaks with a voice resembling "${s.voice}".`)
            .join('\n');

        const jurisdiction = `${country}, ${state || ''}, ${city || ''}`.trim();
        const jurisdictionDetails = jurisdiction
            ? `Ensure the discussion reflects the laws and regulations of ${jurisdiction}.`
            : '';

        // Construct the prompt
        let prompt = `
You are tasked to create a podcast discussion among lawyers. Below are the details:

Speakers:
${speakerDescriptions}

Topic:
"${topic}"

Details:
- The discussion should be dynamic, with realistic arguments, case references, and legal expertise.
- Reflect the jurisdiction: ${jurisdiction}.
- Include logical interruptions and emotional expressions.
- Conclude with actionable advice and solutions to the legal problem.
- Continue the discussion naturally based on the previous context provided.

${jurisdictionDetails}

Previous Context:
${previousLines || ''}

Instructions:
- Generate approximately ${linesPerChunk} lines for this chunk.
- Start with an introduction if this is the first chunk.
- End with closing remarks if this is the final chunk.
- Provide clear, natural, and engaging dialogue.

Output format:
- Each line starts with the speaker's name, followed by their dialogue.
`;

        if (isFirstChunk) {
            prompt += '\n[Introduction: Start the podcast with an engaging introduction.]\n';
        }

        if (isLastChunk) {
            prompt += '\n[Conclusion: Wrap up the podcast with closing remarks and thank the listeners.]\n';
        }

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
                max_tokens: 1000, // Limit tokens per request
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
        const conversationText = data.choices[0].message.content.trim();

        console.log('Generated Chunk:', conversationText);

        res.status(200).json({ conversationText });
    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
