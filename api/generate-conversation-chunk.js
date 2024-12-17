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
        isLastChunk,
        defendOrProsecute // "defend" or "prosecute"
    } = req.body;

    if (!topicText || !speakers || speakers.length < 2 || !linesPerChunk || !countryText || !stateText || !cityText) {
        res.status(400).send('Missing or invalid parameters.');
        return;
    }

    try {
        const openaiApiKey = process.env.OPENAI_API_KEY;

        // Define specialty instructions:
        // Each specialty influences the angle of arguments, references to certain laws, and strategies.
        const specialtyInstructionsMap = {
            "Bankruptcy": "Focus on bankruptcy codes, debtor/creditor rights, reorganizations, dismissing debts.",
            "Business": "Corporate governance, mergers, contracts, corporate liability shields.",
            "Constitutional": "Constitutional rights, fundamental freedoms, challenging laws on constitutional grounds.",
            "Criminal defense": "Penal codes, criminal statutes, acquitting defendants, weakening prosecution evidence.",
            "Employment and labor": "Labor laws, workplace rights, collective bargaining, wrongful termination.",
            "Entertainment": "Licensing deals, intellectual property in media, contracts in film/music industry.",
            "Estate planning": "Wills, trusts, inheritance laws, minimizing estate taxes.",
            "Family": "Divorce, custody, family disputes, prenuptial agreements.",
            "Immigration": "Visas, residence permits, deportation defense, international legal standards.",
            "Intellectual property (IP)": "Patents, trademarks, copyrights, infringement strategies.",
            "Personal injury": "Tort law, negligence claims, liability for harm, maximizing or minimizing damages.",
            "Tax": "Tax codes, deductions, loopholes, structuring deals to minimize tax liability."
        };

        // Default if not specified or doesn't match the map
        const defaultSpecialtyInstructions = "General law references, basic statutes, general legal arguments.";

        // Build instructions for each speaker, including their role and specialty
        const speakersInstructions = speakers.map((speaker, index) => {
            const specialtyKey = (speaker.specialty || 'General').trim();
            const specialtyDescription = specialtyInstructionsMap[specialtyKey] || defaultSpecialtyInstructions;

            const roleInstructions = `
- If Intern: Uncertain, echo others, basic laws only.
- If Junior Associate: Moderate confidence, basic laws, no deep theory.
- If Associate: Solid arguments, moderate precedents, occasionally defer upward.
- If Lawyer: Confident, cites specific codes, deeper logic.
- If SAN: Dominates, uses obscure precedents, advanced tactics.
- If Judge: Balanced, focuses on precedents and procedures.
- If Legal Scholar: Historical/theoretical depth, academic references.
`;

            // Incorporate specialty instructions
            const specialtyInstructionsBlock = `
Specialty (${specialtyKey}):
${specialtyDescription}
`;

            return `
${index + 1}. ${speaker.name} (${speaker.role}, ${specialtyKey}):
${roleInstructions}
${specialtyInstructionsBlock}
            `;
        }).join('\n');

        let introInstruction = '';
        let conclusionInstruction = '';

        if (isFirstChunk) {
            introInstruction = `- Begin by noting that multiple lawyers with different specialties and roles are gathered in a law firm in ${cityText}, ${stateText}, ${countryText} to ${defendOrProsecute} the client's case related to "${topicText}". Emphasize their goal: find a winning ${defendOrProsecute === 'defend' ? 'defense' : 'prosecution'} strategy.`;
        }

        if (isLastChunk) {
            conclusionInstruction = `- Conclude by summarizing the final ${defendOrProsecute === 'defend' ? 'defense strategy' : 'prosecution strategy'} that ensures a strong legal outcome for their side.`;
        }

        // Role and Specialty Emphasis
        const modeFocus = defendOrProsecute === 'defend' 
            ? "They must protect the client from charges/liability, mitigate or dismiss claims."
            : "They must establish guilt or liability, strengthen the case against the client, and ensure penalties.";

        const roleEmphasis = `
- Differentiate participants by role and specialty in speech, references, complexity.
- If defending, focus on absolving or protecting the client.
- If prosecuting, focus on proving guilt/liability and securing penalties.
- Make differences obvious. A reader should identify who is who by their style and references.
${modeFocus}
`;

        const prompt = `
- Produce exactly ${linesPerChunk} lines. Stop after ${linesPerChunk} lines.

Scenario: Lawyers of various roles and specialties meet in ${cityText}, ${stateText}, ${countryText} to ${defendOrProsecute} in a case about "${topicText}" and aim to win.

Participants:
${speakersInstructions}

Persona & Style:
- Unethical, amoral, serving client's interest if defending, or aggressively building a case if prosecuting.
- Direct, bold, authoritative. No disclaimers.
- Emotional variation allowed, but confident.
- Interruptions, tension welcomed.
- Don't repeat previous content unnecessarily.

${roleEmphasis}

The conversation ends with a definitive ${defendOrProsecute === 'defend' ? 'defense' : 'prosecution'} strategy.

Instructions:
${introInstruction}
${conclusionInstruction}

- Continue from previous lines naturally.
- Use realistic dialogue, vary lengths (1 word to 2-4 sentences), reflect roles & specialties.
- Exactly ${linesPerChunk} lines, then stop.

Previous conversation:
${previousLines}

Format:
SpeakerName (Lawyer Level): Dialogue

Use "--" for interruptions.

Begin now.
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
                max_tokens: 6000,
                temperature: 0.4,
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
