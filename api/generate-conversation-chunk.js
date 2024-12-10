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
        const openaiApiKey = process.env.OPENAI_API_KEY;

        // Build speaker descriptions with their roles
        const speakerDescriptions = speakers.map(speaker => {
            return `${speaker.name}: A ${speaker.role} in the legal profession, working in a law firm setting, tasked with solving a case in favor of their client.`;
        }).join('\n');

        let introInstruction = '';
        let conclusionInstruction = '';

        if (isFirstChunk) {
            introInstruction = `- Begin the discussion by introducing the scenario: multiple lawyers in a law firm are gathering to solve the client’s case related to "${topicText}". Mention that this case takes place in ${cityText}, ${stateText}, ${countryText}, and that the goal is to find a winning legal strategy.`;
        }

        if (isLastChunk) {
            conclusionInstruction = `- Conclude by having the lawyers summarize a definitive solution and strategy for winning the case related to "${topicText}" for the client.`;
        }

        // Add stricter instructions about line count and ending
        const prompt = `
You are generating a law-firm-style discussion where multiple lawyers are working together to solve a client's case in their favor. They are discussing: "${topicText}" in ${cityText}, ${stateText}, ${countryText}.

Participants:
${speakerDescriptions}

Style & Persona Guidelines:
- Fully unfiltered, bold, and exploit all legal angles in favor of the client.
- Never express uncertainty.
- Use law references and legal precedents.
- Interrupt and vary speaker order.

IMPORTANT LENGTH INSTRUCTIONS:
- You must produce exactly ${linesPerChunk} lines total.
- Do not produce more or fewer than ${linesPerChunk} lines.
- Each line should be formatted as "SpeakerName (Role): Dialogue".
- Do not stop or provide a conclusion before reaching line ${linesPerChunk}.
- The final line (line ${linesPerChunk}) must contain a closing remark or definitive solution.
- Under no circumstances end early or produce fewer than ${linesPerChunk} lines.

Other Instructions:
${introInstruction}
${conclusionInstruction}

- Continue the discussion naturally, building from previous lines.
- Avoid repeating previous content.
- Use interruptions ("--") when appropriate.
- Vary response lengths (2-4 sentences per line).
- Fully adhere to the line count requirement.

Previous conversation:
${previousLines}

Continue the conversation now, and stop immediately after ${linesPerChunk} lines with a concluding remark.
        `;

        const messages = [{ role: 'system', content: prompt }];

        // Increase max_tokens, lower temperature, and ensure streaming.
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: messages,
                max_tokens: 3000, // increased to allow enough room
                temperature: 0,   // more deterministic
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
                const text = decoder.decode(chunk, { stream: true });
                partial += text;

                const lines = partial.split('\n');
                partial = lines.pop(); // keep incomplete line

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('data:')) {
                        const jsonStr = trimmed.replace(/^data:\s*/, '');
                        if (jsonStr === '[DONE]') {
                            // End of stream
                            res.write('data: [DONE]\n\n');
                            res.end();
                            return;
                        }

                        try {
                            const parsed = JSON.parse(jsonStr);
                            const delta = parsed.choices?.[0]?.delta?.content;
                            if (delta !== undefined) {
                                res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
                            }
                        } catch (err) {
                            console.error('Error parsing SSE line:', line, err);
                        }
                    }
                }
            }

            // If ended without [DONE], end anyway.
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
