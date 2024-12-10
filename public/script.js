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

    const availableVoices = [
        { name: 'Jenny (Female)', value: 'nova' },
        { name: 'Tina (Female)', value: 'shimmer' },
        { name: 'James (Male)', value: 'echo' },
        { name: 'Bond (Male)', value: 'onyx' },
        { name: 'Pinta (Female)', value: 'fable' },
        { name: 'Adam (Male)', value: 'alloy' }
    ];

    const lawyerLevels = [
        'Intern',
        'Junior Associate',
        'Associate',
        'Lawyer',
        'Senior Advocate of Nigeria (SAN)',
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
            nameInput.value = `Speaker${i + 1}`;
            nameInput.placeholder = `Name`;

            const voiceSelect = document.createElement('select');
            availableVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.value;
                option.textContent = voice.name;
                voiceSelect.appendChild(option);
            });
            voiceSelect.selectedIndex = i % availableVoices.length;

            const levelSelect = document.createElement('select');
            lawyerLevels.forEach(level => {
                const option = document.createElement('option');
                option.value = level;
                option.textContent = level;
                levelSelect.appendChild(option);
            });

            speakerConfig.appendChild(nameInput);
            speakerConfig.appendChild(voiceSelect);
            speakerConfig.appendChild(levelSelect);
            speakersContainer.appendChild(speakerConfig);
        }
    }

    numSpeakersInput.addEventListener('change', initializeSpeakers);
    initializeSpeakers();

    generateBtn.addEventListener('click', async () => {
        const topic = textInput.value.trim();
        const country = countryInput.value.trim();
        const state = stateInput.value.trim();
        const city = cityInput.value.trim();
        const numSpeakers = parseInt(numSpeakersInput.value);

        if (!topic || !country || !state || !city) {
            alert('Please fill out all fields: topic, country, state, and city.');
            return;
        }

        const speakers = [];
        const speakerConfigs = document.querySelectorAll('.speaker-config');
        speakerConfigs.forEach(config => {
            const nameInput = config.querySelector('input[type="text"]');
            const voiceSelect = config.querySelector('select');
            const levelSelect = config.querySelector('select:nth-of-type(2)');
            speakers.push({
                name: nameInput.value.trim(),
                voice: voiceSelect.value,
                personalityPrompt: levelSelect.value
            });
        });

        generateBtn.textContent = 'Generating...';
        generateBtn.disabled = true;

        try {
            const audioBlob = await startPodcastGeneration(topic, country, state, city, speakers);
            createDownloadLink(audioBlob);
        } catch (error) {
            console.error(error);
            alert('An error occurred while generating the podcast.');
        } finally {
            generateBtn.textContent = 'Generate Podcast';
            generateBtn.disabled = false;
        }
    });

    async function startPodcastGeneration(topic, country, state, city, speakers) {
        progressDiv.textContent = 'Generating conversation...';
        conversationDiv.innerHTML = '';

        const response = await fetch('/api/generate-conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, location: { country, state, city }, speakers })
        });

        if (!response.ok) {
            throw new Error('Error generating podcast conversation.');
        }

        const { conversation, audioUrls } = await response.json();

        // Display conversation
        conversation.forEach(line => {
            const lineDiv = document.createElement('div');
            lineDiv.textContent = `${line.speaker}: ${line.dialogue}`;
            conversationDiv.appendChild(lineDiv);
        });

        progressDiv.textContent = 'Downloading audio...';

        // Fetch audio files and combine them
        const audioBuffers = await Promise.all(audioUrls.map(fetchAudioBuffer));
        const combinedAudio = combineAudioBuffers(audioBuffers);

        return createAudioBlob(combinedAudio);
    }

    async function fetchAudioBuffer(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error fetching audio.');
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        return audioContext.decodeAudioData(arrayBuffer);
    }

    function combineAudioBuffers(audioBuffers) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const sampleRate = audioBuffers[0].sampleRate;
        const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
        const combined = audioContext.createBuffer(1, totalLength, sampleRate);

        let offset = 0;
        audioBuffers.forEach(buffer => {
            combined.getChannelData(0).set(buffer.getChannelData(0), offset);
            offset += buffer.length;
        });

        return combined;
    }

    function createAudioBlob(buffer) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const wavData = audioContext.createBufferSource().buffer = buffer;
        return new Blob([wavData], { type: 'audio/wav' });
    }

    function createDownloadLink(blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'podcast.wav';
        link.textContent = 'Download Podcast';
        link.style.display = 'block';
        conversationDiv.appendChild(link);
    }
});
