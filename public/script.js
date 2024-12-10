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

        startDiscussionGeneration(text, desiredDuration, countryText, stateText, cityText)
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

    async function startDiscussionGeneration(text, desiredDuration, countryText, stateText, cityText) {
        progressDiv.textContent = 'Generating conversation...';
        conversationDiv.innerHTML = '';
        let audioBuffers = [];
        let conversation = [];

        // Get speaker settings
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

        // Step 1: Estimate the number of lines needed
        const averageWordsPerMinute = 130; // Adjust as needed
        const averageWordsPerLine = 10; // Estimated average words per line
        const totalWordsNeeded = desiredDuration * averageWordsPerMinute;
        const totalLinesNeeded = Math.ceil(totalWordsNeeded / averageWordsPerLine);

        // Determine lines per chunk to stay within API token limits
        const maxTokensPerChunk = 500; 
        const estimatedTokensPerLine = 15; 
        const maxLinesPerChunk = Math.floor(maxTokensPerChunk / estimatedTokensPerLine);

        const linesPerChunk = Math.min(maxLinesPerChunk, totalLinesNeeded);
        const totalChunks = Math.ceil(totalLinesNeeded / linesPerChunk);

        let previousLines = ''; // To keep track of previous lines for context

        // Step 2: Generate the conversation in chunks
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const isFirstChunk = chunkIndex === 0;
            const isLastChunk = chunkIndex === totalChunks - 1;

            progressDiv.textContent = `Generating discussion ${chunkIndex + 1} of ${totalChunks}...`;

            const conversationText = await generateConversationChunk(
                text,
                speakers,
                previousLines,
                linesPerChunk,
                countryText,
                stateText,
                cityText,
                isFirstChunk,
                isLastChunk
            );

            const chunkConversation = parseConversation(conversationText);

            // Update previousLines with the last few lines for context
            previousLines = chunkConversation
                .slice(-2)
                .map(line => `${line.speaker}: ${line.dialogue}`)
                .join('\n');

            conversation = conversation.concat(chunkConversation);

            // Display the conversation as it gets generated
            chunkConversation.forEach(line => {
                const lineDiv = document.createElement('div');
                let content = `${line.speaker}: ${line.dialogue}`;
                lineDiv.textContent = content;
                conversationDiv.appendChild(lineDiv);
            });
        }

        // Step 3: Generate audio for each line with concurrency limit
        audioBuffers = await generateAudioForConversation(conversation, speakers);

        progressDiv.textContent = 'All audio generated. Preparing to play...';

        // Step 4: Create and display the play button
        const playButton = document.createElement('button');
        playButton.textContent = 'Play Discussion';
        playButton.classList.add('play-button');
        playButton.onclick = () => {
            playButton.disabled = true;
            playOverlappingAudio(conversation, audioBuffers);
        };
        conversationDiv.appendChild(playButton);
    }

    async function generateConversationChunk(topicText, speakers, previousLines, linesPerChunk, countryText, stateText, cityText, isFirstChunk, isLastChunk) {
        const response = await fetch('/api/generate-conversation-chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topicText, speakers, previousLines, linesPerChunk, countryText, stateText, cityText, isFirstChunk, isLastChunk })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error generating conversation chunk: ${errorText}`);
        }

        const data = await response.json();
        return data.conversationText;
    }

    function parseConversation(conversationText) {
        const lines = conversationText.split('\n').filter(line => line.trim() !== '');
        const conversation = [];

        lines.forEach((line, index) => {
            // Match speaker and dialogue
            const match = line.match(/^([\w\s]+):\s*(.+)$/);
            if (match) {
                let speaker = match[1].trim();
                let dialogue = match[2].trim();

                // Check for interruptions
                const isInterruption = dialogue.endsWith('--');
                const isContinuation = dialogue.startsWith('--');

                // Clean up dialogue
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
                    alert(`Error generating audio for line ${i + 1}. Check console for details.`);
                    throw error;
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
        if (!audioBuffers || audioBuffers.length === 0) {
            alert('No audio buffers available for playback.');
            return;
        }

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

            // Determine when to start the audio source
            let startTime = currentTime;

            if (line.isInterruption) {
                // Start earlier to overlap with the previous speaker
                startTime -= overlapDuration;
                if (startTime < audioContext.currentTime) {
                    startTime = audioContext.currentTime;
                }
            }

            source.start(startTime);

            sources.push(source);

            // Update currentTime
            if (line.isInterruption) {
                currentTime += buffer.duration - overlapDuration;
            } else {
                currentTime += buffer.duration;
            }

            adjustedBuffers.push(buffer);
        }

        progressDiv.textContent = 'Playing discussion...';

        const combinedBuffer = combineAudioBuffers(adjustedBuffers, audioContext, conversation);
        const wavData = audioBufferToWav(combinedBuffer);
        const audioBlob = new Blob([new DataView(wavData)], { type: 'audio/wav' });

        createDownloadLink(audioBlob);

        const lastSource = sources[sources.length - 1];
        if (lastSource) {
            lastSource.onended = () => {
                progressDiv.textContent = 'Discussion playback finished!';
            };
        } else {
            alert('No audio sources to play.');
        }
    }

    function combineAudioBuffers(audioBuffers, audioContext) {
        const numberOfChannels = audioBuffers[0].numberOfChannels;
        let totalLength = 0;

        audioBuffers.forEach(buffer => {
            totalLength += buffer.length;
        });

        const combinedBuffer = audioContext.createBuffer(
            numberOfChannels,
            totalLength,
            audioBuffers[0].sampleRate
        );

        let offset = 0;
        for (let i = 0; i < audioBuffers.length; i++) {
            const buffer = audioBuffers[i];

            for (let channel = 0; channel < numberOfChannels; channel++) {
                const combinedData = combinedBuffer.getChannelData(channel);
                const bufferData = buffer.getChannelData(channel);

                combinedData.set(bufferData, offset);
            }

            offset += buffer.length;
        }

        return combinedBuffer;
    }

    function audioBufferToWav(buffer, options = {}) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = options.float32 ? 3 : 1; // 3 = IEEE Float, 1 = PCM
        const bitDepth = format === 3 ? 32 : 16;

        let result;
        if (numChannels === 2) {
            result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
        } else {
            result = buffer.getChannelData(0);
        }

        return encodeWAV(result, sampleRate, numChannels, format, bitDepth);
    }

    function interleave(inputL, inputR) {
        const length = inputL.length + inputR.length;
        const result = new Float32Array(length);

        let index = 0;
        let inputIndex = 0;

        while (index < length) {
            result[index++] = inputL[inputIndex];
            result[index++] = inputR[inputIndex];
            inputIndex++;
        }
        return result;
    }

    function encodeWAV(samples, sampleRate, numChannels, format, bitDepth) {
        const buffer = new ArrayBuffer(44 + samples.length * (bitDepth / 8));
        const view = new DataView(buffer);

        /* RIFF identifier */
        writeString(view, 0, 'RIFF');
        /* file length */
        view.setUint32(4, 36 + samples.length * (bitDepth / 8), true);
        /* RIFF type */
        writeString(view, 8, 'WAVE');
        /* format chunk identifier */
        writeString(view, 12, 'fmt ');
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (raw) */
        view.setUint16(20, format, true);
        /* channel count */
        view.setUint16(22, numChannels, true);
        /* sample rate */
        view.setUint32(24, sampleRate, true);
        /* byte rate */
        view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
        /* block align */
        view.setUint16(32, numChannels * (bitDepth / 8), true);
        /* bits per sample */
        view.setUint16(34, bitDepth, true);
        /* data chunk identifier */
        writeString(view, 36, 'data');
        /* data chunk length */
        view.setUint32(40, samples.length * (bitDepth / 8), true);

        if (format === 1) {
            floatTo16BitPCM(view, 44, samples);
        } else {
            writeFloat32(view, 44, samples);
        }

        return buffer;
    }

    function floatTo16BitPCM(output, offset, input) {
        for (let i = 0; i < input.length; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, input[i]));
            output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }

    function writeFloat32(output, offset, input) {
        for (let i = 0; i < input.length; i++, offset += 4) {
            output.setFloat32(offset, input[i], true);
        }
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
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
