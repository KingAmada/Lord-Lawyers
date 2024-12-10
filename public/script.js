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

        const linesPerChunk = 5;//totalLinesNeeded; // single request
        const fullConversationText = await streamConversation(text, speakers, "", linesPerChunk, countryText, stateText, cityText, true, true);

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

    let partialText = '';
    async function streamConversation(topicText, speakers, previousLines, linesPerChunk, countryText, stateText, cityText, isFirstChunk, isLastChunk) {
        const response = await fetch('/api/generate-conversation-chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topicText, speakers, previousLines, linesPerChunk, countryText, stateText, cityText, isFirstChunk, isLastChunk })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error generating conversation chunk: ${errorText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        let fullText = '';
        partialText = ''; // reset buffering

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, {stream:true});
            const lines = chunk.split('\n');

            for (let line of lines) {
                line = line.trim();
                if (!line.startsWith('data:')) continue;

                const jsonStr = line.replace(/^data:\s*/, '');
                if (jsonStr === '[DONE]') {
                    // finalize the conversation
                    finalizeConversation();
                    return fullText;
                }

                try {
                    const parsed = JSON.parse(jsonStr);
                    const content = parsed.content;
                    if (content) {
                        fullText += content;
                        bufferAndDisplayText(content);
                    }
                } catch (err) {
                    console.error('Error parsing streaming line:', line, err);
                }
            }
        }

        // if we somehow ended without [DONE]
        finalizeConversation();
        return fullText;
    }

    function bufferAndDisplayText(content) {
         console.log('Received content chunk:', content); // Debug log each content chunk
        partialText += content;
        // Split on newline to find complete lines
        const lines = partialText.split('\n');
        partialText = lines.pop(); // keep last partial line

        // Display all complete lines
        lines.forEach(ln => {
            if (ln.trim()) {
                console.log('Displaying line:', ln); // Log lines as they are displayed
                const lineDiv = document.createElement('div');
                lineDiv.textContent = ln;
                conversationDiv.appendChild(lineDiv);
                conversationDiv.scrollTop = conversationDiv.scrollHeight;
            }
        });
    }

    function finalizeConversation() {
        // if any leftover text
        if (partialText.trim()) {
            console.log('Final leftover text:', partialText.trim()); // Log leftover text before finalizing
            const lineDiv = document.createElement('div');
            lineDiv.textContent = partialText.trim();
            conversationDiv.appendChild(lineDiv);
            conversationDiv.scrollTop = conversationDiv.scrollHeight;
        }
        partialText = '';
         console.log('Finalization complete.'); // Indicate conversation ended
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

        const combinedBuffer = combineAudioBuffers(adjustedBuffers, audioContext);
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
        audioBuffers.forEach(buffer => { totalLength += buffer.length; });

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
        const format = options.float32 ? 3 : 1;
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
        let index = 0, inputIndex = 0;
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

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * (bitDepth / 8), true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
        view.setUint16(32, numChannels * (bitDepth / 8), true);
        view.setUint16(34, bitDepth, true);
        writeString(view, 36, 'data');
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
