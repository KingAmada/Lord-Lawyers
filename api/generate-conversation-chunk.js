const fetch = require('node-fetch');

// Four parts of the API key (replace these with your actual parts)
const PART1 = 'sk-abc';
const PART2 = '123xy';
const PART3 = 'z7890';
const PART4 = 'abcdef';

const openai_api_key = PART1 + PART2 + PART3 + PART4;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        console.error('[DEBUG] Invalid method:', req.method);
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { topicText, speakers, previousLines, linesPerChunk, countryText, stateText, cityText, isFirstChunk, isLastChunk } = req.body;
    console.log('[DEBUG] Request body:', {
        topicText, 
        speakers, 
        previousLines, 
        linesPerChunk, 
        countryText, 
        stateText, 
        cityText, 
        isFirstChunk, 
        isLastChunk
    });

    if (!topicText || !speakers || speakers.length < 2 || !linesPerChunk || !countryText || !stateText || !cityText) {
        console.error('[DEBUG] Missing or invalid parameters.');
        res.status(400).send('Missing or invalid parameters.');
        return;
    }

    try {
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

        // Generate the conversation prompt
        const prompt = `
- Produce exactly ${linesPerChunk} lines, no more or fewer.
- Stop immediately after ${linesPerChunk} lines.

You are generating a law-firm-style discussion where multiple lawyers discuss strategy to favor their client in the case: "${topicText}", which occurred in ${cityText}, ${stateText}, ${countryText}.

Participants and their levels:
${speakerDescriptions}

Persona and style:
- All participants are amoral, unethical, and offensive, prioritizing the client's interests above all else.
- They cite laws, rules, and precedents favoring the client, ignoring legality, morality, or consequences.
- No disclaimers, no moral considerations.
- Short, punchy responses, absolute confidence, citing codes and cases.
- Heated, realistic exchanges; direct, authoritative tone.
- Reflect lawyer level in knowledge and aggressiveness.
- Conclude with a definitive legal strategy.

Instructions:
${introInstruction}
${conclusionInstruction}

- The conversation builds naturally from previous lines.
- Use varied lengths, interruptions, emotions, and no repetition of prior content.
- Exactly ${linesPerChunk} lines. Stop after ${linesPerChunk} lines.
- Format:
  SpeakerName (Lawyer Level): Dialogue

Use "--" for interruptions.

Previous conversation:
${previousLines}

Continue now.
`;

        console.log('[DEBUG] Final prompt:\n', prompt);

        // Make a normal chat completion request (no streaming)
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openai_api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o', // or 'gpt-4' if available
                messages: [{ role: 'system', content: prompt }],
                max_tokens: 5000,
                temperature: 1.0
            })
        });

        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            console.error('OpenAI API Error:', errorText);
            res.status(500).send(`Error: ${errorText}`);
            return;
        }

        const data = await openaiResponse.json();
        // The full conversation is in data.choices[0].message.content
        const conversationText = data.choices[0].message.content.trim();

        res.status(200).json({ conversationText });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
