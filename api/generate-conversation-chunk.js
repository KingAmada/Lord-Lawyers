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

        // Build the prompt dynamically
        let prompt = `
You are tasked to create a legal podcast discussion between lawyers.

Speakers:
${speakerDescriptions}

Topic:
"${topic}"

Details:
- The conversation should be dynamic, engaging, and legally detailed.
- Reflect the jurisdiction: ${jurisdiction}.
- Include legal arguments, case references, and emotional expressions.
- Conclude with actionable advice and solutions.
- Incorporate interruptions and natural speaker interactions for realism.

${jurisdictionDetails}

Previous Context:
${previousLines || 'No prior context provided.'}

Instructions:
- Generate approximately ${linesPerChunk} lines for this chunk.
- If this is the first chunk, include an engaging introduction.
- If this is the last chunk, include a conclusive closing.
- Format each line as "Speaker Name: Dialogue".
- Use "--" for interruptions or continued sentences.
`;

        if (isFirstChunk) {
            prompt += '\n[Introduction: Open the podcast with an engaging introduction and topic overview.]\n';
        }

        if (isLastChunk) {
            prompt += '\n[Conclusion: Close the podcast with summary remarks and appreciation for listeners.]\n';
        }

        console.log('Generated Prompt for OpenAI API:', prompt);

        // Send the prompt to OpenAI
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [{ role: 'system', content: prompt }],
                max_tokens: 400, // Ensure manageable chunks to avoid timeout
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

        console.log('Generated Conversation Chunk:', conversationText);

        res.status(200).json({ conversationText });
    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
