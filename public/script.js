// public/script.js

document.addEventListener('DOMContentLoaded', () => {
    // ============================
    // Element References
    // ============================
    const generateBtn = document.getElementById('generate-btn');
    const textInput = document.getElementById('text-input');
    const progressDiv = document.getElementById('progress');
    const conversationDiv = document.getElementById('conversation');
    const numSpeakersInput = document.getElementById('num-speakers');
    const speakersContainer = document.getElementById('speakers-container');
    const countryInput = document.getElementById('country-input');
    const stateInput = document.getElementById('state-input');
    const cityInput = document.getElementById('city-input');
    const errorLogDiv = document.getElementById('error-log');
    const statsPanel = document.getElementById('stats-panel');
    const audioFormatSelect = document.getElementById('audio-format');
    const modeSwitch = document.getElementById('defend-prosecute-switch');
    const modeLabel = document.getElementById('mode-label');

    const maxSpeakers = 6;

    // ============================
    // Data and Configuration
    // ============================
    const availableVoices = [
        { name: 'Jenny (Female)', value: 'nova' },
        { name: 'Tina (Female)', value: 'shimmer' },
        { name: 'James (Male)', value: 'echo' },
        { name: 'Bond (Male)', value: 'onyx' },
        { name: 'Pinta (Female)', value: 'fable' },
        { name: 'Adam (Male)', value: 'alloy' }
    ];

    const availableRoles = [
        'Intern',
        'Junior Associate',
        'Associate',
        'Lawyer',
        'SAN',
        'Judge',
        'Legal Scholar'
    ];

    // 12 Specialties
    const availableSpecialties = [
        { name: 'Bankruptcy Lawyer', value: 'Bankruptcy' },
        { name: 'Business Lawyer (Corporate Lawyer)', value: 'Business' },
        { name: 'Constitutional Lawyer', value: 'Constitutional' },
        { name: 'Criminal Defense Lawyer', value: 'Criminal defense' },
        { name: 'Employment and Labor Lawyer', value: 'Employment and labor' },
        { name: 'Entertainment Lawyer', value: 'Entertainment' },
        { name: 'Estate Planning Lawyer', value: 'Estate planning' },
        { name: 'Family Lawyer', value: 'Family' },
        { name: 'Immigration Lawyer', value: 'Immigration' },
        { name: 'Intellectual Property (IP) Lawyer', value: 'Intellectual property (IP)' },
        { name: 'Personal Injury Lawyer', value: 'Personal injury' },
        { name: 'Tax Lawyer', value: 'Tax' }
    ];

    // ============================
    // Initialization Functions
    // ============================
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

            const specialtySelect = document.createElement('select');
            availableSpecialties.forEach(spec => {
                const option = document.createElement('option');
                option.value = spec.value;
                option.textContent = spec.name;
                specialtySelect.appendChild(option);
            });

            speakerConfig.appendChild(nameInput);
            speakerConfig.appendChild(voiceSelect);
            speakerConfig.appendChild(roleSelect);
            speakerConfig.appendChild(specialtySelect);

            speakersContainer.appendChild(speakerConfig);
        }
    }

    // Load previous session from localStorage if available
    loadPreviousSession();
    initializeSpeakers();

    numSpeakersInput.addEventListener('change', () => {
        let numSpeakers = parseInt(numSpeakersInput.value);
        if (numSpeakers < 2) numSpeakers = 2;
        if (numSpeakers > maxSpeakers) numSpeakers = maxSpeakers;
        numSpeakersInput.value = numSpeakers;
        initializeSpeakers();
    });

    // Defend/Prosecute mode switch
    modeSwitch.addEventListener('change', () => {
        modeLabel.textContent = modeSwitch.checked ? 'Prosecute' : 'Defend';
    });

    // ============================
    // Event Listeners
    // ============================
    generateBtn.addEventListener('click', async () => {
        const text = textInput.value.trim();
        const durationInput = document.getElementById('podcast-duration');
        const desiredDuration = parseInt(durationInput.value);
        const countryText = countryInput.value.trim();
        const stateText = stateInput.value.trim();
        const cityText = cityInput.value.trim();

        // Validate Inputs
        if (!text) {
            showError('Please enter details about the case.');
            return;
        }

        if (isNaN(desiredDuration) || desiredDuration < 1) {
            showError('Please enter a valid desired duration in minutes.');
            return;
        }

        if (!countryText || !stateText || !cityText) {
            showError('Please enter country, state, and city.');
            return;
        }

        // Save current session
        saveCurrentSession(text, desiredDuration, countryText, stateText, cityText);

        generateBtn.textContent = 'Generating...';
        generateBtn.disabled = true;
        showLoading();

        try {
            await startDiscussionGeneration(text, desiredDuration, countryText, stateText, cityText);
        } catch (error) {
            console.error(error);
            showError('An error occurred while generating the discussion.');
        } finally {
            generateBtn.textContent = 'Generate Discussion';
            generateBtn.disabled = false;
            hideLoading();
        }
    });

    // ============================
    // Core Functions
    // ============================

    async function startDiscussionGeneration(text, desiredDuration, countryText, stateText, cityText) {
        progressDiv.textContent = 'Generating conversation...';
        conversationDiv.innerHTML = '';

        const speakers = gatherSpeakerData();
        const { linesPerChunk, totalWordsNeeded } = calculateLineAndWordCount(desiredDuration);
        const defendOrProsecute = modeSwitch.checked ? 'prosecute' : 'defend';

        // Show stats
        updateStatsPanel(totalWordsNeeded, linesPerChunk);

        const fullConversationText = await generateConversation(
            text,
            speakers,
            "",
            linesPerChunk,
            countryText,
            stateText,
            cityText,
            true,
            true,
            defendOrProsecute
        );

        progressDiv.textContent = 'Conversation generation complete. Displaying text...';
        displayGeneratedText(fullConversationText);

        progressDiv.textContent = 'Now generating audio...';

        const conversation = parseConversation(fullConversationText);
        let progressBar = createProgressBar(conversation.length);
        progressDiv.appendChild(progressBar);

        const audioBuffers = await generateAudioForConversation(conversation, speakers, progressBar);

        progressDiv.textContent = 'All audio generated. Preparing download...';

        const format = audioFormatSelect.value || 'wav';
        const audioBlob = await combineAndConvertAudio(audioBuffers, format);

        createDownloadLink(audioBlob, format);
        progressDiv.textContent = 'Process complete! You can now play or download the audio.';
    }

    function gatherSpeakerData() {
        const speakers = [];
        const speakerConfigs = document.querySelectorAll('.speaker-config');
        speakerConfigs.forEach(config => {
            const inputs = config.querySelectorAll('input, select');
            const nameInput = inputs[0];
            const voiceSelect = inputs[1];
            const roleSelect = inputs[2];
            const specialtySelect = inputs[3];

            const name = nameInput.value.trim();
            const voice = voiceSelect.value;
            const role = roleSelect.value;
            const specialty = specialtySelect.value;

            speakers.push({ name, voice, role, specialty });
        });
        return speakers;
    }

    function calculateLineAndWordCount(desiredDuration) {
        const averageWordsPerMinute = 230;
        const averageWordsPerLine = 20;
        const totalWordsNeeded = desiredDuration * averageWordsPerMinute;
        const linesPerChunk = Math.ceil(totalWordsNeeded / averageWordsPerLine);
        return { linesPerChunk, totalWordsNeeded };
    }

    function updateStatsPanel(totalWords, totalLines) {
        if (!statsPanel) return;
        statsPanel.innerHTML = `
            <p><strong>Estimated Words:</strong> ${totalWords}</p>
            <p><strong>Estimated Lines:</strong> ${totalLines}</p>
            <p><strong>Note:</strong> Actual output may vary.</p>
        `;
    }

    function displayGeneratedText(fullConversationText) {
        const lines = fullConversationText.split('\n').filter(line => line.trim() !== '');
        lines.forEach(line => {
            const lineDiv = document.createElement('div');
            lineDiv.textContent = line;
            conversationDiv.appendChild(lineDiv);
        });
        conversationDiv.scrollTop = conversationDiv.scrollHeight;
    }

    function createProgressBar(total) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('progress-bar-wrapper');

        const label = document.createElement('div');
        label.textContent = `Audio generation progress: 0/${total}`;
        label.classList.add('progress-bar-label');
        wrapper.appendChild(label);

        const barContainer = document.createElement('div');
        barContainer.classList.add('progress-bar-container');

        const bar = document.createElement('div');
        bar.classList.add('progress-bar');
        bar.style.width = '0%';
        barContainer.appendChild(bar);

        wrapper.appendChild(barContainer);

        wrapper._bar = bar;
        wrapper._label = label;
        wrapper._total = total;
        wrapper._current = 0;

        wrapper.update = function() {
            this._current++;
            const percent = Math.floor((this._current / this._total) * 100);
            this._bar.style.width = percent + '%';
            this._label.textContent = `Audio generation progress: ${this._current}/${this._total}`;
        };

        return wrapper;
    }

    async function generateConversation(topicText, speakers, previousLines, linesPerChunk, countryText, stateText, cityText, isFirstChunk, isLastChunk, defendOrProsecute) {
        const response = await fetch('/api/generate-conversation-chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topicText, speakers, previousLines, linesPerChunk, countryText, stateText, cityText, isFirstChunk, isLastChunk, defendOrProsecute })
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

    async function generateAudioForConversation(conversation, speakers, progressBar) {
        const audioBuffers = [];
        const concurrencyLimit = 3; 
        let index = 0;
        let errorsEncountered = false;

        async function worker() {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            while (index < conversation.length) {
                const i = index++;
                const line = conversation[i];
                try {
                    const speakerVoice = speakers.find(s => s.name === line.speaker)?.voice || 'echo';
                    const audioBuffer = await generateAudioBuffer(line.speaker, line.dialogue, speakerVoice, audioContext);
                    audioBuffers[i] = audioBuffer;
                    if (progressBar && typeof progressBar.update === 'function') {
                        progressBar.update();
                    }
                } catch (error) {
                    console.error(`Error generating audio for line ${i + 1}:`, error);
                    showError(`Error generating audio for line ${i + 1}. Check console for details.`);
                    errorsEncountered = true;
                }
            }
        }

        const workers = [];
        for (let i = 0; i < concurrencyLimit; i++) {
            workers.push(worker());
        }

        await Promise.all(workers);

        if (errorsEncountered) {
            showError('Some audio lines failed to generate. The final audio may be incomplete.');
        }

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

    async function combineAndConvertAudio(audioBuffers, format) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const combinedBuffer = combineAudioBuffers(audioBuffers, audioContext);

        // Convert to WAV first
        const wavData = audioBufferToWav(combinedBuffer);
        const wavBlob = new Blob([new DataView(wavData)], { type: 'audio/wav' });

        if (format === 'mp3') {
            // If MP3 conversion is requested, you'd need a client-side MP3 encoder.
            // For now, just return WAV.
            return wavBlob;
        }

        return wavBlob;
    }

    function createDownloadLink(audioBlob, format = 'wav') {
        const url = URL.createObjectURL(audioBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `discussion.${format}`;
        downloadLink.textContent = 'Download Discussion';
        downloadLink.style.display = 'block';
        downloadLink.style.marginTop = '10px';
        downloadLink.style.color = '#fff';
        downloadLink.style.textDecoration = 'underline';
        conversationDiv.appendChild(downloadLink);
    }

    function showError(message) {
        if (!errorLogDiv) return;
        const errorEntry = document.createElement('div');
        errorEntry.classList.add('error-entry');
        errorEntry.textContent = message;
        errorLogDiv.appendChild(errorEntry);
        errorLogDiv.scrollTop = errorLogDiv.scrollHeight;
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

    function saveCurrentSession(text, duration, country, state, city) {
        const sessionData = { text, duration, country, state, city };
        localStorage.setItem('lastSession', JSON.stringify(sessionData));
    }

    function loadPreviousSession() {
        const saved = localStorage.getItem('lastSession');
        if (!saved) return;
        try {
            const sessionData = JSON.parse(saved);
            if (sessionData.text) textInput.value = sessionData.text;
            if (sessionData.duration) {
                const durationInput = document.getElementById('podcast-duration');
                durationInput.value = sessionData.duration;
            }
            if (sessionData.country) countryInput.value = sessionData.country;
            if (sessionData.state) stateInput.value = sessionData.state;
            if (sessionData.city) cityInput.value = sessionData.city;
        } catch (e) {
            // Ignore parsing errors
        }
    }

    // NOTE: The generated content may be unethical or mature. Use responsibly.
});
