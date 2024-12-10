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
            nameInput.placeholder = 'Name';

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
        const duration = parseInt(document.getElementById('podcast-duration').value);

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
        progressDiv.textContent = 'Preparing to generate podcast...';

        try {
            const audioBuffers = await startPodcastGeneration(topic, country, state, city, duration, speakers);
            playGeneratedAudio(audioBuffers);
        } catch (error) {
            console.error(error);
            alert('An error occurred while generating the podcast.');
        } finally {
            generateBtn.textContent = 'Generate Podcast';
            generateBtn.disabled = false;
        }
    });

    async function startPodcastGeneration(topic, country, state, city, duration, speakers) {
        progressDiv.textContent = 'Generating podcast...';
        conversationDiv.innerHTML = '';
        const totalWordsNeeded = duration * 130; // Approx. words per minute
        const locationContext = `This podcast is focused on ${city}, ${state}, ${country}.`;

        const response = await fetch('/api/generate-conversation-chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic,
                locationContext,
                speakers,
                totalWordsNeeded
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error generating podcast: ${errorText}`);
        }

        const data = await response.json();
        const conversation = data.conversation;

        progressDiv.textContent = 'Generating audio for podcast...';
        const audioBuffers = await generateAudioForConversation(conversation, speakers);

        return audioBuffers;
    }

    async function generateAudioForConversation(conversation, speakers) {
        const audioBuffers = [];
        for (const line of conversation) {
            const speakerVoice = speakers.find(s => s.name === line.speaker)?.voice;
            if (!speakerVoice) continue;

            const audioBuffer = await generateAudioBuffer(line.dialogue, speakerVoice);
            audioBuffers.push(audioBuffer);
        }
        return audioBuffers;
    }

    async function generateAudioBuffer(dialogue, voice) {
        const response = await fetch('/api/generate-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dialogue, voice })
        });

        if (!response.ok) {
            throw new Error('Error generating audio buffer');
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        return await audioContext.decodeAudioData(arrayBuffer);
    }

    function playGeneratedAudio(audioBuffers) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        let startTime = audioContext.currentTime;

        audioBuffers.forEach(buffer => {
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(startTime);
            startTime += buffer.duration;
        });

        progressDiv.textContent = 'Podcast playback completed!';
    }
});
