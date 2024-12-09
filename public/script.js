document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const textInput = document.getElementById('text-input');
    const progressDiv = document.getElementById('progress');
    const conversationDiv = document.getElementById('conversation');
    const numSpeakersInput = document.getElementById('num-speakers');
    const speakersContainer = document.getElementById('speakers-container');

    // List of available lawyer levels and voices
    const lawyerLevels = [
        'Intern',
        'Junior Associate',
        'Associate',
        'Partner',
        'Senior Advocate',
        'Judge',
        'Legal Scholar'
    ];
    const availableVoices = [
        { name: 'Jenny (Female)', value: 'nova' },
        { name: 'Tina (Female)', value: 'shimmer' },
        { name: 'James (Male)', value: 'echo' },
        { name: 'Bond (Male)', value: 'onyx' },
        { name: 'Pinta (Female)', value: 'fable' },
        { name: 'Adam (Male)', value: 'alloy' }
    ];

    function initializeSpeakers() {
        const numSpeakers = parseInt(numSpeakersInput.value);
        speakersContainer.innerHTML = '';

        for (let i = 0; i < numSpeakers; i++) {
            const speakerConfig = document.createElement('div');
            speakerConfig.classList.add('speaker-config');

            // Input for lawyer name
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = `Lawyer ${i + 1} Name`;

            // Dropdown for lawyer level
            const levelSelect = document.createElement('select');
            lawyerLevels.forEach(level => {
                const option = document.createElement('option');
                option.value = level;
                option.textContent = level;
                levelSelect.appendChild(option);
            });

            // Dropdown for voice selection
            const voiceSelect = document.createElement('select');
            availableVoices.forEach(voice => {
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
        const duration = parseInt(document.getElementById('podcast-duration').value);
        const country = document.getElementById('country').value.trim();
        const state = document.getElementById('state').value.trim();
        const city = document.getElementById('city').value.trim();

        const speakers = Array.from(speakersContainer.children).map(config => {
            const name = config.querySelector('input').value.trim();
            const level = config.querySelector('select:nth-child(2)').value;
            const voice = config.querySelector('select:nth-child(3)').value;
            return { name, level, voice };
        });

        if (!topic || speakers.length < 2 || !country) {
            alert('Please provide a topic, at least 2 lawyers, and jurisdiction details.');
            return;
        }

        progressDiv.textContent = 'Generating podcast...';

        try {
            const response = await fetch('/api/generate-conversation-chunk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, speakers, country, state, city, duration })
            });

            const data = await response.json();
            const conversation = data.conversationText;

            conversationDiv.innerHTML = '';
            const lines = conversation.split('\n');
            lines.forEach(line => {
                const lineDiv = document.createElement('div');
                lineDiv.textContent = line;
                conversationDiv.appendChild(lineDiv);
            });

            await generateAudio(conversation, speakers);
        } catch (error) {
            console.error(error);
            alert('Failed to generate podcast.');
        }
    });

    async function generateAudio(conversation, speakers) {
        progressDiv.textContent = 'Generating audio...';

        const lines = conversation.split('\n');
        const audioBuffers = [];
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        for (let i = 0; i < lines.length; i++) {
            const [speaker, dialogue] = lines[i].split(':').map(s => s.trim());
            if (!dialogue) continue;

            const speakerConfig = speakers.find(s => s.name === speaker);
            const voice = speakerConfig?.voice || 'default';

            try {
                const audioBuffer = await fetchAudio(dialogue, voice);
                audioBuffers.push(audioBuffer);
            } catch (err) {
                console.error(`Error generating audio for line ${i + 1}:`, err);
            }
        }

        progressDiv.textContent = 'Audio generated. Playing...';
        playAudio(audioBuffers, audioContext);
    }

    async function fetchAudio(dialogue, voice) {
        const response = await fetch('/api/generate-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dialogue, voice })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch audio.');
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        return await audioContext.decodeAudioData(arrayBuffer);
    }

    function playAudio(audioBuffers, audioContext) {
        let currentTime = audioContext.currentTime;

        audioBuffers.forEach(buffer => {
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(currentTime);
            currentTime += buffer.duration;
        });
    }
});
