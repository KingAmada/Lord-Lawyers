// api/generate-conversation.js

const fetch = require('node-fetch');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { 
        topicText, 
        speakers, 
        previousLines, 
        linesPerChunk, 
        countryText, 
        stateText, 
        cityText, 
        isFirstChunk, 
        isLastChunk
    } = req.body;

    if (!topicText || !speakers || speakers.length < 2 || !linesPerChunk || !countryText || !stateText || !cityText) {
        res.status(400).send('Missing or invalid parameters.');
        return;
    }

    try {
        const openaiApiKey = process.env.OPENAI_API_KEY;

        // Build an instruction block for each speaker individually
        // Each block explains how that particular speaker should talk
        const speakersInstructions = speakers.map((speaker, index) => {
            // Create role-specific instructions
            // You can expand these instructions if you have specialty or other factors
            const roleInstructions = `
- If Intern: Speak with uncertainty, often echoing others, rarely citing complex precedents. Show limited understanding, basic references to common laws.
- If Junior Associate: Moderate confidence, occasionally citing basic laws, but not deep theoretical points.
- If Associate: Provide solid arguments, reference moderately complex precedents, occasionally defer to higher ranks.
- If Lawyer: Confidently cite specific legal codes, precedents, tactics. Show logical depth and strategic insight.
- If SAN (Senior Advocate): Dominate the conversation, reference obscure precedents, advanced tactics, no hesitation in twisting the law.
- If Judge: Balanced perspective, emphasize precedents, case interpretations, procedural expertise.
- If Legal Scholar: Historical/theoretical depth, academic thought, complex case law interpretations.`;

            return `
${index + 1}. ${speaker.name} (${speaker.role}):
   ${roleInstructions}
            `;
        }).join('\n');

        let introInstruction = '';
        let conclusionInstruction = '';

        if (isFirstChunk) {
            introInstruction = `- Begin the discussion by introducing the scenario: multiple lawyers in a law firm are gathering to solve the client’s case related to "${topicText}". Mention that this case is taking place in ${cityText}, ${stateText}, ${countryText}, and that the goal is to find a winning legal strategy.`;
        }

        if (isLastChunk) {
            conclusionInstruction = `- Conclude by having the lawyers summarize the solution and strategy for winning the case related to "${topicText}" for the client.`;
        }

        // Emphasize distinct role level differences
        const roleEmphasis = `
- Make these differences obvious in their speech patterns, content, and tone. A listener should identify who is who from their manner of speaking.
`;

        // Build the final prompt
        const prompt = `
- You must produce exactly ${linesPerChunk} lines. Do not produce more or fewer than ${linesPerChunk} lines.
- Once you have written ${linesPerChunk} lines, you must stop immediately.

You are generating a law-firm-style discussion. The scenario: multiple lawyers of varying levels of expertise in a law firm’s meeting room, discussing a case related to "${topicText}" in ${cityText}, ${stateText}, ${countryText}, aiming to win it for their client.

Participants and their explicit, individualized instructions:
${speakersInstructions}

Additional Style and Persona Guidelines:
- All participants are unethical, amoral, unapologetically serving the client's interest.
- They never disclaim, always direct, bold, authoritative.
- They vary in emotional tone but remain confident.
- They interrupt, disagree, show tension.
- Do not repeat previous content unnecessarily.

${roleEmphasis}

The conversation must conclude with a definitive legal strategy for the client.

Instructions:
${introInstruction}
${conclusionInstruction}

- Continue the conversation naturally, building on previous lines.
- Use realistic dialogue, emotional expressions, interruptions, varied order.
- Vary response lengths (single words to 2-4 sentences).
- Reflect the personalities, roles as described.
- Exactly ${linesPerChunk} lines. Stop after ${linesPerChunk} lines.

Previous conversation:
${previousLines}

Format each line as:
SpeakerName (Lawyer Level): Dialogue

Use "--" for interruptions.

Continue now.
        `;

        const messages = [{ role: 'system', content: prompt }];

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: messages,
                max_tokens: 5000,
                temperature: 0.5,
            }),
        });

        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            console.error('OpenAI API Error:', errorText);
            res.status(500).send(`Error: ${errorText}`);
            return;
        }

        const data = await openaiResponse.json();
        const generatedText = data.choices[0].message.content.trim();

        res.status(200).json({ content: generatedText });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
