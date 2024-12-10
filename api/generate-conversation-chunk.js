// api/generate-conversation-chunk.js

const fetch = require('node-fetch');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { topicText, speakers, previousLines, linesPerChunk, countryText, stateText, cityText, isFirstChunk, isLastChunk } = req.body;

    if (!topicText || !speakers || speakers.length < 2 || !linesPerChunk || !countryText || !stateText || !cityText) {
        res.status(400).send('Missing or invalid parameters.');
        return;
    }

    try {
        const openai_api_key = process.env.OPENAI_API_KEY;

        // Build speaker descriptions with their roles
        const speakerDescriptions = speakers.map(speaker => {
            return `${speaker.name}: A ${speaker.role} in the legal profession, working in a law firm setting, tasked with solving a case in favor of their client.`;
        }).join('\n');

        let introInstruction = '';
        let conclusionInstruction = '';

        if (isFirstChunk) {
            introInstruction = `- Begin the discussion by introducing the scenario: multiple lawyers in a law firm are gathering to solve the client’s case related to "${topicText}". Mention that this case is taking place in ${cityText}, ${stateText}, ${countryText}, and that the goal is to find a winning legal strategy.`;
        }

        if (isLastChunk) {
            conclusionInstruction = `- Conclude by having the lawyers summarize the solution and strategy for winning the case related to "${topicText}" for the client.`;
        }

        // Incorporate the topicText into the conversation prompt
        let prompt = `
You are generating a law-firm-style discussion (not a podcast) where multiple lawyers of varying levels of expertise are actively working together to solve a client's case in their favor. They are physically in a law firm meeting room, discussing strategy, citing laws and legal precedents relevant to the case on the topic: "${topicText}".

The scenario takes place in ${cityText}, ${stateText}, ${countryText}.

The participants:

${speakerDescriptions}

They have the following style and persona guidelines:
- Each speaker behaves as an emergency lawyer with a clever, slightly crooked demeanor.
- They respond with bold confidence, citing relevant laws, rules, and regulations that favor the client.
- They always aim to convince using the law, leveraging the constitution, user rights, state laws, county laws, and federal laws.
- Their tone can vary (angry, sad, happy, etc.) but they are always brief, punchy, and convincing.
- They do not express uncertainty or lack of knowledge.
- They refer to legal codes, acts, and precedents whenever possible.
- They are working together (with some interruptions and disagreements) to craft the best possible legal defense and strategy concerning the "${topicText}" case.

Instructions:

${introInstruction}
${conclusionInstruction}

- The conversation should continue naturally, building on previous lines.
- Include realistic dialogue with emotional expressions, interruptions, and varied speaker order.
- Use fillers and emotional expressions for depth.
- Vary response lengths, from single words to longer replies (2-4 sentences).
- Reflect the personalities as described (confidence, cleverness, etc.).
- Avoid repeating previous content.
- Approximate length: ${linesPerChunk} lines.
- Always keep in mind: The objective is to solve the client's case related to "${topicText}" in favor of the client.

Previous conversation:
${previousLines}

Continue the conversation now. Format each line as:

SpeakerName: Dialogue

Use "--" for interruptions.
        `;

        const messages = [
            {
                role: 'system',
                content: prompt
            }
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openai_api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: messages,
                max_tokens: 800,
                temperature: 1.0
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
