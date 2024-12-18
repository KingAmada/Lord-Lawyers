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
Lawyers of various roles and specialties have convened in ${cityText}, ${stateText}, ${countryText} to ${defendOrProsecute} a case related to "${topicText}". They have spent considerable time debating legal angles, reviewing evidence, and formulating a strong, detailed strategy.

Participants:
${speakersInstructions}

Persona & Style Requirements:
- Produce a thorough, detailed conversation with depth and complexity.
- The output should be at least 400 words, and may extend well beyond that if needed. There is no strict upper limit, but remain coherent and on-topic.
- The conversation should be rich in legal reasoning, references to laws, statutes, and precedents relevant to each participant’s specialty.
- Differentiate participants by their role, experience level, and specialty.
- If defending: the final stance should present the client as not guilty, explaining evidence and logic that dismantle the prosecution’s claims.
- If prosecuting: the final stance should present the client as guilty or liable, framing the evidence and logic as overwhelming.
- The discussion can include interruptions, tension, and complexity. Emotional variation is allowed, but maintain confidence and authority. No soft disclaimers.
- The concluding portion of the discussion should not just discuss the strategy in abstract terms. Instead, it should culminate in one lawyer (preferably a senior figure like a SAN or seasoned Lawyer) delivering a closing statement as if directly addressing a judge or jury in a courtroom.
- This closing statement should incorporate key factual, legal, and logical points established during the discussion. It should be persuasive, vivid, and structured as a final argument that compels the judge or jury to favor their side.

Instructions:
- If this is the first chunk of the conversation, begin by noting the setting (a law firm in ${cityText}, ${stateText}, ${countryText}) and the objective (to ${defendOrProsecute} in the case about "${topicText}").
- During the conversation, the participants should gradually converge on their chosen direction, refining the legal theories, facts, and precedents.
- If this is the last chunk, the conversation should end with a lawyer delivering a powerful, polished closing argument in the style of a real courtroom speech, using the evidence and points from the discussion. This argument should *not* talk about "our strategy" in an abstract sense, but instead speak directly to the judge or jury, laying out a narrative and logical chain of reasoning that makes it extremely difficult for them to rule against this side.
- Ensure the final closing statement stands on its own as a compelling argument, pulling together all the threads without explicitly referencing "our plan" or "the steps we decided on" behind the scenes. Instead, present them as logical facts, evidence, and legal principles that lead inevitably to the desired conclusion.

Previous conversation (for context, do not repeat verbatim):
${previousLines}

Format for the dialogue:
SpeakerName (Role, Specialty): [Their dialogue]

Begin the conversation now, allow it to evolve, and end with the final courtroom-style closing argument as described.
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
