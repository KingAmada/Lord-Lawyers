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

    // List of roles
    const availableRoles = [
        'Intern',
        'Junior Associate',
        'Associate',
        'Lawyer',
        'SAN',
        'Judge',
        'Legal Scholar'
    ];

    // Initialize speaker configurations
    function initializeSpeakers() {
        const numSpeakers = parseInt(numSpeakersInput.value);
        speakersContainer.innerHTML = '';

        for (let i = 0; i < numSpeakers; i++) {
            const speakerConfig = document.createElement('div');
            speakerConfig.classList.add('speaker-config');

            // Speaker Name Input
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = `Lawyer${i + 1}`;
            nameInput.placeholder = `Name`;

            // Voice Selection Dropdown
            const voiceSelect = document.createElement('select');
            availableVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.value;
                option.textContent = voice.name;
                voiceSelect.appendChild(option);
            });

            // Assign voices in order
            const voiceIndex = i % availableVoices.length;
            voiceSelect.selectedIndex = voiceIndex;

            // Role Selection Dropdown
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

    // Event listener for changes in the number of speakers
    numSpeakersInput.addEventListener('change', () => {
        let numSpeakers = parseInt(numSpeakersInput.value);
        if (numSpeakers < 2) numSpeakers = 2;
        if (numSpeakers > maxSpeakers) numSpeakers = maxSpeakers;
        numSpeakersInput.value = numSpeakers;
        initializeSpeakers();
    });

    // Call initializeSpeakers on page load
    initializeSpeakers();

    generateBtn.addEventListener('click', () => {
        const text = textInput.value.trim();
        const durationInput = document.getElementById('podcast-duration');
        const desiredDuration = parseInt(durationInput.value);

        const countryText = countryInput.value.trim();
        const stateText = stateInput.value.trim();
        const cityText = cityInput.value.trim();

        if (text === '') {
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

        // Show loading animation
        showLoading();

        startDiscussionStreaming(text, desiredDuration, countryText, stateText, cityText)
            .catch(error => {
                console.error(error);
                alert('An error occurred while generating the discussion.');
            })
            .finally(() => {
                generateBtn.textContent = 'Generate Discussion';
                generateBtn.disabled = false;
                // Hide loading animation
                hideLoading();
            });
    });

    async function startDiscussionStreaming(text, desiredDuration, countryText, stateText, cityText) {
        progressDiv.textContent = 'Receiving live updates...';
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

        let audioBuffers = [];
        const conversation = [];

        try {
            const response = await fetch('/api/generate-conversation-chunk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topicText: text,
                    speakers,
                    previousLines: '',
                    linesPerChunk: 10, // Adjustable chunk size
                    countryText,
                    stateText,
                    cityText,
                    isFirstChunk: true,
                    isLastChunk: false
                })
            });

            if (!response.body) throw new Error('ReadableStream not supported in this browser.');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            let content = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                content += decoder.decode(value, { stream: true });

                // Process lines and update conversationDiv
                const conversationLines = content.split('\n').filter(line => line.trim() !== '');
                conversationDiv.innerHTML = '';
                conversationLines.forEach(line => {
                    const lineDiv = document.createElement('div');
                    lineDiv.textContent = line;
                    conversationDiv.appendChild(lineDiv);

                    // Add each parsed line to the conversation array
                    const [speaker, dialogue] = line.split(':');
                    if (speaker && dialogue) {
                        conversation.push({ speaker: speaker.trim(), dialogue: dialogue.trim() });
                    }
                });
            }

            // Generate audio for each conversation line
            audioBuffers = await generateAudioForConversation(conversation, speakers);

            progressDiv.textContent = 'All audio generated. Preparing to play...';

            // Create and display the play button
            const playButton = document.createElement('button');
            playButton.textContent = 'Play Discussion';
            playButton.classList.add('play-button');
            playButton.onclick = () => {
                playButton.disabled = true;
                playOverlappingAudio(conversation, audioBuffers);
            };
            conversationDiv.appendChild(playButton);
        } catch (error) {
            console.error('Error during streaming or audio generation:', error);
            throw error;
        }
    }

    async function generateAudioForConversation(conversation, speakers) {
        const audioBuffers = [];
        const concurrencyLimit = 3;
        let index = 0;

        async function worker() {
            while (index < conversation.length) {
                const i = index++;
                const line = conversation[i];
                progressDiv.textContent = `Generating audio ${i + 1} of ${conversation.length}...`;

                try {
                    const speakerVoice = speakers.find(s => s.name === line.speaker)?.voice;

                    let voiceToUse = speakerVoice;
                    if (!voiceToUse) {
                        throw new Error(`Voice not found for speaker ${line.speaker}`);
                    }

                    const audioBuffer = await generateAudioBuffer(line.speaker, line.dialogue, voiceToUse);
                    audioBuffers[i] = audioBuffer;
                } catch (error) {
                    console.error(`Error generating audio for line ${i + 1}:`, error);
                }
            }
        }

        // Start workers
        const workers = [];
        for (let i = 0; i < concurrencyLimit; i++) {
            workers.push(worker());
        }

        await Promise.all(workers);

        return audioBuffers;
    }

    async function generateAudioBuffer(speaker, dialogue, voice) {
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
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        try {
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            return audioBuffer;
        } catch (error) {
            console.error('Error decoding audio data:', error);
            throw error;
        }
    }

    async function playOverlappingAudio(conversation, audioBuffers) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        let currentTime = audioContext.currentTime;
        const overlapDuration = 0.5; // Duration of overlap in seconds

        const sources = [];
        const adjustedBuffers = [];

        for (let i = 0; i < audioBuffers.length; i++) {
            const buffer = audioBuffers[i];
            const line = conversation[i];

            const gainNode = audioContext.createGain();
            gainNode.gain.value = 1.0; // Default volume

            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(gainNode).connect(audioContext.destination);

            let startTime = currentTime;
            source.start(startTime);
            sources.push(source);

            currentTime += buffer.duration - overlapDuration;
        }

        const combinedBuffer = combineAudioBuffers(adjustedBuffers, audioContext);
        const wavData = audioBufferToWav(combinedBuffer);
        const audioBlob = new Blob([new DataView(wavData)], { type: 'audio/wav' });

        createDownloadLink(audioBlob);

        progressDiv.textContent = 'Discussion playback finished!';
    }

    function createDownloadLink(audioBlob) {
        const url = URL.createObjectURL(audioBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = 'discussion.wav';
        downloadLink.textContent = 'Download Discussion';
        conversationDiv.appendChild(downloadLink);
    }

    // Loading animations
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
