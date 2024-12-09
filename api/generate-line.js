// api/generate-line.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { topicText, conversationHistory } = req.body;

    if (!topicText || !conversationHistory) {
        res.status(400).send('Missing parameters.');
        return;
    }

    try {
        const openai_api_key = process.env.OPENAI_API_KEY;

        // Prepare the messages for the Chat Completion API
        const messages = [
            {
                role: 'system',
                content: `
You are to create a podcast conversation between four people: two females (**Sarah** and **Rachel**) and two males (**Tom** and **Mike**). They are discussing the following text:

"${topicText}"

The conversation should be natural and include interruptions, fillers like "um", "ah", "you know", etc. Each person should bring their thoughts, reasoning, and exploration about the text. Ensure the conversation feels authentic, as if on a real podcast.

**Important Instructions:**

- Only use the names **Sarah**, **Rachel**, **Tom**, or **Mike** as the speaker names.
- **Provide only one line of dialogue from a single speaker** per response.
- Do not include other speakers' responses or any narration.
- Format the response exactly as:

Speaker: Dialogue

For example:

Sarah: This is the first line of dialogue.

Only provide the next line without repeating the previous conversation.
                `
            }
        ];

        // Add the conversation history
        conversationHistory.forEach(line => {
            messages.push({
                role: 'assistant',
                content: `${line.speaker}: ${line.dialogue}`
            });
        });

        // Request the next line from the Chat Completion API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openai_api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: messages,
                max_tokens: 150,
                temperature: 0.3, // Lowered for more deterministic output
                stop: null
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('OpenAI API Error:', error);
            res.status(500).send('Error generating next line.');
            return;
        }

        const data = await response.json();
        const nextLineText = data.choices[0].message.content.trim();

        // Use regex to extract speaker and dialogue
        const match = nextLineText.match(/^(\w+):\s*(.+)$/);

        if (!match) {
            console.error(`Failed to parse the line: "${nextLineText}"`);
            res.status(500).send('Error parsing the generated line.');
            return;
        }

        const speaker = match[1].trim();
        const dialogue = match[2].trim();

        const nextLine = { speaker, dialogue };

        res.status(200).json({ nextLine });
    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).send('Server error.');
    }
};
