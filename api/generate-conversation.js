// api/generate-conversation.js

const fetch = require('node-fetch');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { topicText, speakers } = req.body;

    if (!topicText || !speakers || speakers.length < 2) {
        res.status(400).send('Missing or invalid parameters.');
        return;
    }

    try {
        const openai_api_key = process.env.OPENAI_API_KEY;

        // Generate speaker names list
        const speakerNames = speakers.map(s => s.name);

        const messages = [
            {
                role: 'system',
                content: `
You are to create a podcast conversation between the following people:
${speakerNames.join(', ')}.

They are discussing the following topic:

"${topicText}"

The conversation should be:

- Highly interactive and dynamic, with frequent interruptions, overlaps, and varied speaker order.
- Responses should vary in length, including very short replies like "uh-huh", "yeah", "okay", as well as longer responses of 2-3 sentences.
- Speakers should chime in randomly, not following any fixed sequence; anyone can jump in at any time.
- Include natural speech fillers like "um", "ah", "you know", "uh-huh", "yeah", "oh", "hmm", and expressions of emotion spelled out in the dialogue.
- Incorporate little human noises like laughs ("haha", "heh"), sighs ("sigh"), gasps ("gasp"), and other non-verbal expressions spelled out in the dialogue.
- Each person's speech should reflect their personality and perspective.
- The conversation should feel authentic and spontaneous, as if it's happening in real-time on a podcast.
- Avoid using any bracketed annotations like [laughs], [sighs], [interrupting], etc.
- Instead of brackets, spell out the sounds directly in the dialogue (e.g., "Haha, that's funny!" or "Oh, um, I didn't know that.").

Format the conversation as follows:

- Each line should start with the speaker's name, followed by a colon, and then their dialogue.
- Indicate interruptions or overlaps using double dashes "--".

Example:

Sarah: You know, I was thinking--
Mike: --thinking about the same thing! Haha!
Alex: Oh, really? That's funny.
Sarah: Yeah.
Mike: Exactly!

Now, please provide the full conversation.
                `
            }
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openai_api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: messages,
                max_tokens: 300, // Adjust if needed
                temperature: 0.9   // Increase for more creativity
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('OpenAI API Error:', error);
            res.status(500).send(`Error generating conversation: ${error.error.message}`);
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
