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
Scenario:
Lawyers of various roles and specialties have convened in ${cityText}, ${stateText}, ${countryText} to ${defendOrProsecute} a case related to "${topicText}". They aim to produce a comprehensive and highly detailed ${defendOrProsecute === 'defend' ? 'defense' : 'prosecution'} strategy. Multiple lawyers, each with distinct roles and specialties, discuss and debate the issues at length.

Participants:
${speakersInstructions}

Persona & Style Requirements:
- Produce a thorough discussion with depth, detail, and complexity. 
- The output should be at least 400 words. If needed or if the discussion naturally extends, it can surpass 2,000 words. There is no upper strict limit, but keep it coherent and on-topic.
- The conversation should be rich in legal reasoning, references to laws (based on specialties), precedents, and strategies.
- Display clear differences between participants by their role, experience level, and specialty. 
- If defending: prioritize absolving the client, weakening opposing evidence, and ensuring the client's protection.
- If prosecuting: emphasize establishing the client's guilt/liability, presenting strong evidence, and ensuring a firm legal stance.
- All participants may interrupt, dispute, or challenge each other’s assertions, creating a lively, intense debate.
- Emotional variation is allowed, but maintain confidence and authority. No disclaimers, no softening language—be direct and bold.
- The final portion of the discussion should naturally coalesce into a definitive ${defendOrProsecute === 'defend' ? 'defense' : 'prosecution'} strategy that all participants either agree upon or acknowledge as the chosen path.

Instructions:
- If this is the first chunk of the conversation, start by noting the setting (a law firm in ${cityText}, ${stateText}, ${countryText}) and the objective (to ${defendOrProsecute} in the case about "${topicText}").
- If this is the last chunk, ensure that the discussion concludes with a clear, well-defined strategy.
- Integrate references to relevant legal codes, precedents, and strategic considerations based on each speaker’s specialty and role.
- Vary the length of each speaker’s turn. Some may speak briefly (just a sentence), while others may present longer, multi-sentence arguments. 
- Make the discussion feel natural, as if participants are responding to and building upon each other’s points.
- Refer to the previous conversation context where helpful, but do not repeat it unnecessarily.

Previous conversation (for context, do not repeat verbatim):
${previousLines}

Format for the dialogue:
SpeakerName (Role, Specialty): [Their dialogue]

Begin the conversation now and continue until the discussion reaches a natural, comprehensive, and strategic conclusion.
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
