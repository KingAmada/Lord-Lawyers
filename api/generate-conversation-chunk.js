const fetch = require('node-fetch');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { topic, speakers, country, state, city, duration } = req.body;

    if (!topic || !speakers || speakers.length < 2 || !country) {
        res.status(400).send('Missing or invalid parameters.');
        return;
    }

    try {
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

        // Construct speaker descriptions
        const speakerDescriptions = speakers.map(speaker => {
            return `${speaker.name}, a ${speaker.level} lawyer, speaks with a voice resembling "${speaker.voice}".`;
        }).join('\n');

        // Construct jurisdiction information
        const jurisdiction = `${country}, ${state || ''}, ${city || ''}`.trim();
        const jurisdictionMessage = jurisdiction
            ? `Ensure the discussion is aligned with the laws and regulations in ${jurisdiction}.`
            : '';

        // Create the prompt
        const prompt = `
You are to create a legal podcast conversation between the following lawyers:

${speakerDescriptions}

They are discussing the topic: "${topic}".

Conversation details:
- The discussion should reflect the legal expertise and level of each lawyer.
- Include detailed arguments, case references, and laws relevant to the jurisdiction (${jurisdiction}).
- Make the conversation dynamic and interactive, with interruptions, questions, and varied responses.
- Use realistic dialogue with fillers, emotional expressions, and some humor where appropriate.
- Avoid repeating content or deviating from the legal topic.
- Include a clear conclusion after approximately ${duration} minutes of discussion.

${jurisdictionMessage}

Format:
- Each line starts with the speaker's name, followed by their dialogue.
- Indicate interruptions using "--".

Example:
Sarah: This is my opening argument--
John: --and let me counter that point.

Now generate the next part of the conversation.
        `;

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
                temperature: 0.8,
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('OpenAI API Error:', error);
            res.status(500).send(`Error generating conversation chunk: ${error.error.message}`);
            return;
        }

        const data = await response.json();
        const conversationText = data.choices[0].message.content.trim();

        res.status(200).json({ conversationText });
    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).send('Server error.');
    }
};
