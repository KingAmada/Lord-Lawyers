// public/script.js

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

        // Calculate lines needed
        const averageWordsPerMinute = 130;
        const averageWordsPerLine = 10;
        const totalWordsNeeded = desiredDuration * averageWordsPerMinute;
        const totalLinesNeeded = Math.ceil(totalWordsNeeded / averageWordsPerLine);

        const linesPerChunk = totalLinesNeeded; // single request
        const fullConversationText = await generateConversation(text, speakers, "", linesPerChunk, countryText, stateText, cityText, true, true);

        progressDiv.textContent = 'Conversation generation complete. Now generating audio...';

        const conversation = parseConversation(fullConversationText);
        const audioBuffers = await generateAudioForConversation(conversation, speakers);

        progressDiv.textContent = 'All audio generated. Preparing to play...';

        const playButton = document.createElement('button');
        playButton.textContent = 'Play Discussion';
        playButton.classList.add('play-button');
        playButton.onclick = () => {
            playButton.disabled = true;
            playOverlappingAudio(conversation, audioBuffers);
        };
        conversationDiv.appendChild(playButton);
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

    function parseConversation(conversationText) {
        const lines = conversationText.split('\n').filter(line => line.trim() !== '');
        const conversation = [];

        lines.forEach((line, index) => {
            const match = line.match(/^([\w\s]+)\([^)]*\):\s*(.+)$/);
            if (match) {
                let speaker = match[1].trim();
                let dialogue = match[2].trim();
                const isInterruption = dialogue.endsWith('--');
                const isContinuation = dialogue.startsWith('--');
                dialogue = dialogue.replace(/^--/, '').replace(/--$/, '').trim();

                conversation.push({
                    speaker,
                    dialogue,
                    isInterruption,
                    isContinuation,
                    index
                });
            }
        });

        return conversation;
    }

    async function generateAudioForConversation(conversation, speakers) {
        const audioBuffers = [];
        const concurrencyLimit = 3; 
        let index = 0;

        async function worker() {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            while (index < conversation.length) {
                const i = index++;
                const line = conversation[i];
                progressDiv.textContent = `Generating audio ${i + 1} of ${conversation.length}...`;

                try {
                    const speakerVoice = speakers.find(s => s.name === line.speaker)?.voice || 'echo';
                    const audioBuffer = await generateAudioBuffer(line.speaker, line.dialogue, speakerVoice, audioContext);
                    audioBuffers[i] = audioBuffer;
                } catch (error) {
                    console.error(`Error generating audio for line ${i + 1}:`, error);
                    alert(`Error generating audio for line ${i + 1}. Check console for details.`);
                    throw error;
                }
            }
        }

        const workers = [];
        for (let i = 0; i < concurrencyLimit; i++) {
            workers.push(worker());
        }

        await Promise.all(workers);

        return audioBuffers;
    }

    async function generateAudioBuffer(speaker, dialogue, voice, audioContext) {
        const response = await fetch('/api/generate-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ speaker, dialogue, voice })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error generating audio: ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    }

    async function playOverlappingAudio(conversation, audioBuffers) {
        if (!audioBuffers || audioBuffers.length === 0) {
            alert('No audio buffers available for playback.');
            return;
        }

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        let currentTime = audioContext.currentTime;
        const overlapDuration = 0.5;
        const sources = [];
        const adjustedBuffers = [];

        for (let i = 0; i < audioBuffers.length; i++) {
            const buffer = audioBuffers[i];
            const line = conversation[i];

            const gainNode = audioContext.createGain();
            gainNode.gain.value = 1.0;

            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(gainNode).connect(audioContext.destination);

            let startTime = currentTime;
            if (line.isInterruption) {
                startTime -= overlapDuration;
                if (startTime < audioContext.currentTime) {
                    startTime = audioContext.currentTime;
                }
            }

            source.start(startTime);
            sources.push(source);

            if (line.isInterruption) {
                currentTime += buffer.duration - overlapDuration;
            } else {
                currentTime += buffer.duration;
            }

            adjustedBuffers.push(buffer);
        }

        progressDiv.textContent = 'Playing discussion...';

        const lastSource = sources[sources.length - 1];
        if (lastSource) {
            lastSource.onended = () => {
                progressDiv.textContent = 'Discussion playback finished!';
            };
        } else {
            alert('No audio sources to play.');
        }
    }

    function showLoading() {
        let loadingOverlay = document.createElement('div');
        loadingOverlay.classList.add('loading-overlay');

        let spinner = document.createElement('div');
        spinner.classList.add('loading-spinner');
        spinner.innerHTML = '<div></div>';

        loadingOverlay.appendChild(spinner);
        document.body.appendChild(loadingOverlay);
        loadingOverlay.style.display = 'block';
    }

    function hideLoading() {
        let loadingOverlay = document.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
            loadingOverlay.remove();
        }
    }
});
