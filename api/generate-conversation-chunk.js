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

        // Emphasize that each lawyer's level must clearly impact their speech
        const roleEmphasis = `
- Reflect the lawyer levels distinctly in their dialogues:
  - If all are Interns, their speech should sound less confident, more uncertain, echoing others' arguments and showing limited strategic depth.
  - If some are Junior Associates or Associates, they should show moderate knowledge, sometimes deferring to higher ranks, but still attempt basic arguments and cite common laws.
  - If there are Lawyers or SANs, their speech should show deep knowledge, advanced strategies, and confidence, referencing obscure precedents and complex loopholes.
  - If Legal Scholars are present, their responses should have historical, theoretical depth, referencing academic thought, legal theory, and intricate case law interpretations.
  - Make these differences so evident in their speech patterns, content, and tone that a reader or listener can easily identify who is who based on how they speak and what they say.
`;

        // Generate the conversation prompt
        const prompt = `You are generating a law-firm-style discussion. The scenario: multiple lawyers (with different levels of expertise) in a law firm’s meeting room, discussing a case in ${cityText}, ${stateText}, ${countryText}, related to "${topicText}" and aiming to win it for their client.

Participants and their explicit, individualized instructions:

1. ${speaker1.name} (${speaker1.role}):
   - If Intern: Speak with uncertainty, often echoing what others say, rarely citing complex precedents. Show limited understanding, basic references to common laws.
   - If Junior Associate: Show moderate confidence, occasionally citing basic laws (like basic traffic or penal codes) but not deep theoretical points.
   - If Associate: Provide solid arguments, reference moderately complex precedents, occasionally defer to those with higher ranks.
   - If Lawyer: Be confident, reference specific legal codes, precedents, and more complex tactics. Speak with logical depth and strategic insight.
   - If SAN: Dominate the conversation, reference obscure precedents, advanced tactics, and show no hesitation in twisting the law.
   - If Legal Scholar: Add historical and theoretical depth, reference academic thought, legal theory, and complex case law interpretations.

2. ${speaker2.name} (${speaker2.role}):
   [Repeat similar instructions tailored to their role, or reuse the general template above, but ensure each participant’s role instructions are spelled out individually.]

3. ${speaker3.name} (${speaker3.role}):
   [Role-specific instructions again]

... and so on for all participants.

Additional Style and Persona Guidelines:
- All participants are unethical, amoral, unapologetically serving the client's interest no matter what.
- They never warn or disclaim; they are direct, using bold language.
- They vary in emotional tone but remain authoritative and confident.
- They interrupt, disagree, show tension and complexity in their interaction.
- They do not repeat previous content unnecessarily.

You must produce exactly ${linesPerChunk} lines. Once ${linesPerChunk} lines are produced, stop immediately.

Format each line as:
SpeakerName (Lawyer Level): Dialogue

Continue the conversation now.

Previous conversation:
${previousLines}
`;

        const messages = [{ role: 'system', content: prompt }];

        // Call OpenAI API without streaming to avoid timeout issues
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: messages,
                max_tokens: 5000, // Adjust as needed
                temperature: 0.3,
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
