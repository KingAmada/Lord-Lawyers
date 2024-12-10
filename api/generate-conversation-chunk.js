// api/generate-conversation-chunk.js

const fetch = require('node-fetch');

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
        const openaiApiKey = process.env.OPENAI_API_KEY;

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

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'system', content: prompt }],
                max_tokens: 5000,
                temperature: 1.0,
                stream: true,
            }),
        });

        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            console.error('OpenAI API Error:', errorText);
            res.status(500).send(`Error: ${errorText}`);
            return;
        }

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const decoder = new TextDecoder();
        let partial = '';

        try {
            for await (const chunk of openaiResponse.body) {
                console.log('[DEBUG] Raw chunk from OpenAI:', chunk);

                const text = decoder.decode(chunk, { stream: true });
                partial += text;

                const lines = partial.split('\n');
                partial = lines.pop(); // keep incomplete line

                for (const line of lines) {
                    const trimmed = line.trim();
                    console.log('[DEBUG] SSE line:', trimmed);

                    if (trimmed.startsWith('data:')) {
                        const jsonStr = trimmed.replace(/^data:\s*/, '');
                        console.log('[DEBUG] JSON string:', jsonStr);

                        if (jsonStr === '[DONE]') {
                            console.log('[DEBUG] Received [DONE], ending stream.');
                            res.write('data: [DONE]\n\n');
                            res.end();
                            return;
                        }

                        try {
                            const parsed = JSON.parse(jsonStr);
                            const delta = parsed.choices?.[0]?.delta?.content;
                            if (delta !== undefined) {
                                console.log('[DEBUG] Delta content:', delta);
                                res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
                            }
                        } catch (err) {
                            console.error('Error parsing SSE line:', line, err);
                        }
                    }
                }
            }

            // If ended without [DONE], just end
            console.log('[DEBUG] Stream ended without [DONE]. Ending anyway.');
            res.write('data: [DONE]\n\n');
            res.end();
        } catch (err) {
            console.error('Error reading stream:', err);
            res.status(500).send('Internal Server Error');
        }

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
