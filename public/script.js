document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const textInput = document.getElementById('text-input');
    const progressDiv = document.getElementById('progress');
    const conversationDiv = document.getElementById('conversation');
    const numSpeakersInput = document.getElementById('num-speakers');
    const speakersContainer = document.getElementById('speakers-container');
    const promoInput = document.getElementById('promo-input');

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
            const voiceIndex = i % availableVoices.length;
            voiceSelect.selectedIndex = voiceIndex;

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
        const text = textInput.value.trim();
        const durationInput = document.getElementById('podcast-duration');
        const desiredDuration = parseInt(durationInput.value);
        const promoText = promoInput.value.trim();

        if (text === '') {
            alert('Please enter a topic for the podcast.');
            return;
        }

        if (isNaN(desiredDuration) || desiredDuration < 1) {
            alert('Please enter a valid desired duration in minutes.');
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

        showLoading();

        try {
            await startPodcastGeneration(text, desiredDuration, promoText, speakers);
        } catch (error) {
            console.error(error);
            alert('An error occurred while generating the podcast.');
        } finally {
            generateBtn.textContent = 'Generate Podcast';
            generateBtn.disabled = false;
            hideLoading();
        }
    });

    async function startPodcastGeneration(text, desiredDuration, promoText, speakers) {
        progressDiv.textContent = 'Generating conversation...';
        conversationDiv.innerHTML = '';
        let audioBuffers = [];
        let conversation = [];

        const totalWordsNeeded = desiredDuration * 130; // Words per minute
        const totalLinesNeeded = Math.ceil(totalWordsNeeded / 10); // Words per line
        const linesPerChunk = Math.min(33, totalLinesNeeded); // Approximate chunk size
        const totalChunks = Math.ceil(totalLinesNeeded / linesPerChunk);

        let previousLines = '';

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const isFirstChunk = chunkIndex === 0;
            const isLastChunk = chunkIndex === totalChunks - 1;

            progressDiv.textContent = `Generating podcast chunk ${chunkIndex + 1} of ${totalChunks}...`;

            const conversationText = await generateConversationChunk(
                text, speakers, previousLines, linesPerChunk, promoText, isFirstChunk, isLastChunk
            );

            const chunkConversation = parseConversation(conversationText);

            previousLines = chunkConversation
                .slice(-2)
                .map(line => `${line.speaker}: ${line.dialogue}`)
                .join('\n');

            conversation = conversation.concat(chunkConversation);

            chunkConversation.forEach(line => {
                const lineDiv = document.createElement('div');
                lineDiv.textContent = `${line.speaker}: ${line.dialogue}`;
                conversationDiv.appendChild(lineDiv);
            });
        }

        audioBuffers = await generateAudioForConversation(conversation, speakers);

        progressDiv.textContent = 'Podcast generation complete. Preparing audio playback...';

        const playButton = document.createElement('button');
        playButton.textContent = 'Play Podcast';
        playButton.onclick = () => playGeneratedAudio(audioBuffers);
        conversationDiv.appendChild(playButton);
    }

    async function generateConversationChunk(topicText, speakers, previousLines, linesPerChunk, promoText, isFirstChunk, isLastChunk) {
        const response = await fetch('/api/generate-conversation-chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topicText, speakers, previousLines, linesPerChunk, promoText, isFirstChunk, isLastChunk })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error generating conversation chunk: ${errorText}`);
        }

        const data = await response.json();
        return data.conversationText;
    }

    async function generateAudioForConversation(conversation, speakers) {
        const audioBuffers = [];
        for (const line of conversation) {
            const speakerVoice = speakers.find(s => s.name === line.speaker)?.voice;
            if (!speakerVoice) continue;
            const audioBuffer = await generateAudioBuffer(line.speaker, line.dialogue, speakerVoice);
            audioBuffers.push(audioBuffer);
        }
        return audioBuffers;
    }

    async function generateAudioBuffer(speaker, dialogue, voice) {
        const response = await fetch('/api/generate-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ speaker, dialogue, voice })
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
    }

    function parseConversation(conversationText) {
        return conversationText.split('\n').map(line => {
            const [speaker, ...dialogueParts] = line.split(':');
            return { speaker: speaker.trim(), dialogue: dialogueParts.join(':').trim() };
        });
    }

    function showLoading() {
        const overlay = document.createElement('div');
        overlay.classList.add('loading-overlay');
        const spinner = document.createElement('div');
        spinner.classList.add('loading-spinner');
        overlay.appendChild(spinner);
        document.body.appendChild(overlay);
    }

    function hideLoading() {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) overlay.remove();
    }
});
