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
            introInstruction = `- Begin the discussion by introducing the scenario: multiple lawyers in a law firm are gathering to solve the client’s case related to "${topicText}". Mention that this case is taking place in ${cityText}, ${stateText}, ${countryText}, and that the goal is to find a winning legal strategy.`;
        }

        if (isLastChunk) {
            conclusionInstruction = `- Conclude by having the lawyers summarize the solution and strategy for winning the case related to "${topicText}" for the client.`;
        }

        // Generate the conversation prompt
        const prompt = `
Generate a law-firm-style discussion where lawyers collaborate on a case: "${topicText}" in ${cityText}, ${stateText}, ${countryText}. Participants vary in expertise (${speakerDescriptions}) and prioritize the client’s interest above all else, citing laws, loopholes, and precedents boldly. Responses are unfiltered, confident, and heated, reflecting lawyer levels (interns to scholars). Conclude with a clear legal strategy. Use realistic, varied dialogue with emotional depth, avoiding repetition. Produce exactly ${linesPerChunk} lines.
`;

        const messages = [{ role: 'system', content: prompt }];

        // Request to OpenAI with streaming
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: messages,
                max_tokens: 6850,
                temperature: 0.3,
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

            // If ended without [DONE], just end
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
