document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const textInput = document.getElementById('text-input');
    const progressDiv = document.getElementById('progress');
    const conversationDiv = document.getElementById('conversation');
    const numSpeakersInput = document.getElementById('num-speakers');
    const speakersContainer = document.getElementById('speakers-container');
    const countryInput = document.getElementById('country-input');
    const stateInput = document.getElementById('state-input');
    const cityInput = document.getElementById('city-input');

    const maxSpeakers = 6;

    // List of available voices
    const availableVoices = [
        { name: 'Jenny (Female)', value: 'nova' },
        { name: 'Tina (Female)', value: 'shimmer' },
        { name: 'James (Male)', value: 'echo' },
        { name: 'Bond (Male)', value: 'onyx' },
        { name: 'Pinta (Female)', value: 'fable' },
        { name: 'Adam (Male)', value: 'alloy' }
    ];

    // Roles
    const availableRoles = [
        'Intern', 
        'Junior Associate', 
        'Associate', 
        'Lawyer', 
        'SAN', 
        'Judge', 
        'Legal Scholar'
    ];

    function initializeSpeakers() {
        const numSpeakers = parseInt(numSpeakersInput.value);
        speakersContainer.innerHTML = '';

        for (let i = 0; i < numSpeakers; i++) {
            const speakerConfig = document.createElement('div');
            speakerConfig.classList.add('speaker-config');

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = `Lawyer${i + 1}`;
            nameInput.placeholder = `Name`;

            const voiceSelect = document.createElement('select');
            availableVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.value;
                option.textContent = voice.name;
                voiceSelect.appendChild(option);
            });
            voiceSelect.selectedIndex = i % availableVoices.length;

            const roleSelect = document.createElement('select');
            availableRoles.forEach(role => {
                const option = document.createElement('option');
                option.value = role;
                option.textContent = role;
                roleSelect.appendChild(option);
            });

            speakerConfig.appendChild(nameInput);
            speakerConfig.appendChild(voiceSelect);
            speakerConfig.appendChild(roleSelect);

            speakersContainer.appendChild(speakerConfig);
        }
    }

    numSpeakersInput.addEventListener('change', () => {
        let numSpeakers = parseInt(numSpeakersInput.value);
        if (numSpeakers < 2) numSpeakers = 2;
        if (numSpeakers > maxSpeakers) numSpeakers = maxSpeakers;
        numSpeakersInput.value = numSpeakers;
        initializeSpeakers();
    });

    initializeSpeakers();

    generateBtn.addEventListener('click', async () => {
        const text = textInput.value.trim();
        const durationInput = document.getElementById('podcast-duration');
        const desiredDuration = parseInt(durationInput.value);
        const countryText = countryInput.value.trim();
        const stateText = stateInput.value.trim();
        const cityText = cityInput.value.trim();

        if (!text) {
            alert('Please enter details about the case.');
            return;
        }

        if (isNaN(desiredDuration) || desiredDuration < 1) {
            alert('Please enter a valid desired duration in minutes.');
            return;
        }

        if (!countryText || !stateText || !cityText) {
            alert('Please enter country, state, and city.');
            return;
        }

        generateBtn.textContent = 'Generating...';
        generateBtn.disabled = true;
        showLoading();

        try {
            await startDiscussionGeneration(text, desiredDuration, countryText, stateText, cityText);
        } catch (error) {
            console.error(error);
            alert('An error occurred while generating the discussion.');
        } finally {
            generateBtn.textContent = 'Generate Discussion';
            generateBtn.disabled = false;
            hideLoading();
        }
    });

    async function startDiscussionGeneration(text, desiredDuration, countryText, stateText, cityText) {
        progressDiv.textContent = 'Generating conversation...';
        conversationDiv.innerHTML = '';

        const speakers = [];
        const speakerConfigs = document.querySelectorAll('.speaker-config');
        speakerConfigs.forEach(config => {
            const nameInput = config.querySelector('input[type="text"]');
            const voiceSelect = config.querySelector('select:first-of-type');
            const roleSelect = config.querySelector('select:last-of-type');
            const name = nameInput.value.trim();
            const voice = voiceSelect.value;
            const role = roleSelect.value;
            speakers.push({ name, voice, role });
        });

        const averageWordsPerMinute = 130;
        const averageWordsPerLine = 10;
        const totalWordsNeeded = desiredDuration * averageWordsPerMinute;
        const totalLinesNeeded = Math.ceil(totalWordsNeeded / averageWordsPerLine);

        const linesPerChunk = totalLinesNeeded;
        const fullConversationText = await generateConversation(text, speakers, "", linesPerChunk, countryText, stateText, cityText, true, true);

        progressDiv.textContent = 'Conversation generation complete. Displaying text...';

        // Display text in the conversation div
        const lines = fullConversationText.split('\n').filter(line => line.trim() !== '');
        lines.forEach(line => {
            const lineDiv = document.createElement('div');
            lineDiv.textContent = line;
            conversationDiv.appendChild(lineDiv);
        });

        const conversation = parseConversation(fullConversationText);
        const audioBuffers = await generateAudioForConversation(conversation, speakers);

        progressDiv.textContent = 'All audio generated. Preparing download...';

        const combinedBuffer = combineAudioBuffers(audioBuffers, new AudioContext());
        const wavData = audioBufferToWav(combinedBuffer);
        const audioBlob = new Blob([new DataView(wavData)], { type: 'audio/wav' });

        createDownloadLink(audioBlob);
    }

    async function generateConversation(topicText, speakers, previousLines, linesPerChunk, countryText, stateText, cityText, isFirstChunk, isLastChunk) {
        const response = await fetch('/api/generate-conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topicText, speakers, previousLines, linesPerChunk, countryText, stateText, cityText, isFirstChunk, isLastChunk })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error generating conversation: ${errorText}`);
        }

        const data = await response.json();
        return data.content;
    }

    function createDownloadLink(audioBlob) {
        const url = URL.createObjectURL(audioBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = 'discussion.wav';
        downloadLink.textContent = 'Download Discussion';
        downloadLink.style.display = 'block';
        downloadLink.style.marginTop = '10px';
        downloadLink.style.color = '#fff';
        downloadLink.style.textDecoration = 'underline';
        conversationDiv.appendChild(downloadLink);
    }

    function showLoading() {
        const loadingOverlay = document.createElement('div');
        loadingOverlay.classList.add('loading-overlay');
        document.body.appendChild(loadingOverlay);
    }

    function hideLoading() {
        const loadingOverlay = document.querySelector('.loading-overlay');
        if (loadingOverlay) loadingOverlay.remove();
    }
});
