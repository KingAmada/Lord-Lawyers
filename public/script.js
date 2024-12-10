document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const textInput = document.getElementById('text-input');
    const progressDiv = document.getElementById('progress');
    const conversationDiv = document.getElementById('conversation');
    const numSpeakersInput = document.getElementById('num-speakers');
    const speakersContainer = document.getElementById('speakers-container');
    const stopBtn = document.getElementById('stop-btn');

    const numRepliesPerChunk = 2; // Number of replies to generate per chunk
    let isGenerating = false;

    // Initialize the speaker settings
    function initializeSpeakers() {
        const numSpeakers = parseInt(numSpeakersInput.value);
        speakersContainer.innerHTML = ''; // Clear previous configurations

        for (let i = 0; i < numSpeakers; i++) {
            const speakerConfig = document.createElement('div');
            speakerConfig.classList.add('speaker-config');

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = `Lawyer ${i + 1} Name`;
            nameInput.classList.add('name-input');

            const levelSelect = document.createElement('select');
            ['Intern', 'Junior Associate', 'Associate', 'Partner', 'Senior Advocate', 'Judge', 'Legal Scholar'].forEach(level => {
                const option = document.createElement('option');
                option.value = level;
                option.textContent = level;
                levelSelect.appendChild(option);
            });

            const voiceSelect = document.createElement('select');
            [
                { name: 'Jenny (Female)', value: 'nova' },
                { name: 'Tina (Female)', value: 'shimmer' },
                { name: 'James (Male)', value: 'echo' },
                { name: 'Bond (Male)', value: 'onyx' },
                { name: 'Pinta (Female)', value: 'fable' },
                { name: 'Adam (Male)', value: 'alloy' }
            ].forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.value;
                option.textContent = voice.name;
                voiceSelect.appendChild(option);
            });

            speakerConfig.appendChild(nameInput);
            speakerConfig.appendChild(levelSelect);
            speakerConfig.appendChild(voiceSelect);
            speakersContainer.appendChild(speakerConfig);
        }
    }

    numSpeakersInput.addEventListener('change', initializeSpeakers);
    initializeSpeakers();

    generateBtn.addEventListener('click', async () => {
        const topic = textInput.value.trim();
        const speakers = getSpeakersConfig();
        const country = document.getElementById('country').value.trim();
        const state = document.getElementById('state').value.trim();
        const city = document.getElementById('city').value.trim();

        if (!topic || speakers.length < 2 || !country) {
            alert('Please provide a topic, at least 2 lawyers, and jurisdiction details.');
            return;
        }

        conversationDiv.innerHTML = ''; // Clear previous conversation
        progressDiv.textContent = 'Generating podcast...';

        try {
            isGenerating = true;
            stopBtn.style.display = 'inline-block';
            let previousLines = ''; // Carry forward context
            let chunkIndex = 0;

            while (isGenerating) {
                progressDiv.textContent = `Generating chunk ${++chunkIndex}...`;

                const response = await fetch('/api/generate-conversation-chunk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic,
                        speakers,
                        country,
                        state,
                        city,
                        previousLines,
                        numReplies: numRepliesPerChunk
                    })
                });

                if (!response.ok) {
                    console.error('API Error:', response.statusText);
                    break;
                }

                const { conversationText } = await response.json();
                const chunkLines = conversationText.split('\n');

                // Update the context for the next request
                previousLines = chunkLines.slice(-3).join('\n');

                // Append the new lines to the conversation
                chunkLines.forEach(line => {
                    const lineDiv = document.createElement('div');
                    lineDiv.textContent = line;
                    conversationDiv.appendChild(lineDiv);
                });

                // Optional: Pause for effect (e.g., 1-second delay between chunks)
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            progressDiv.textContent = 'Podcast generation complete!';
        } catch (error) {
            console.error('Error during generation:', error);
            alert('Failed to generate podcast. Check the logs for details.');
        } finally {
            isGenerating = false;
            stopBtn.style.display = 'none';
        }
    });

    stopBtn.addEventListener('click', () => {
        isGenerating = false;
        progressDiv.textContent = 'Podcast generation stopped.';
    });

    function getSpeakersConfig() {
        const speakerConfigs = Array.from(speakersContainer.children);
        return speakerConfigs.map(config => {
            const name = config.querySelector('.name-input').value.trim();
            const level = config.querySelector('select:nth-child(2)').value;
            const voice = config.querySelector('select:nth-child(3)').value;
            return { name, level, voice };
        });
    }
});
