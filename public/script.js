document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const textInput = document.getElementById('text-input');
    const progressDiv = document.getElementById('progress');
    const conversationDiv = document.getElementById('conversation');
    const numSpeakersInput = document.getElementById('num-speakers');
    const speakersContainer = document.getElementById('speakers-container');
    const audioContainer = document.getElementById('audio-container');

    const maxTokensPerChunk = 1000; // OpenAI API token limit
    const averageWordsPerLine = 10;
    const estimatedTokensPerLine = 15;
    const linesPerChunk = Math.floor(maxTokensPerChunk / estimatedTokensPerLine);

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

    let audioBuffers = [];
    let combinedAudioBuffer = null;

    // Initialize the speaker configuration
    function initializeSpeakers() {
        const numSpeakers = parseInt(numSpeakersInput.value);
        speakersContainer.innerHTML = '';

        for (let i = 0; i < numSpeakers; i++) {
            const speakerConfig = document.createElement('div');
            speakerConfig.classList.add('speaker-config');

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = `Lawyer ${i + 1} Name`;
            nameInput.classList.add('name-input');

            const levelSelect = document.createElement('select');
            lawyerLevels.forEach(level => {
                const option = document.createElement('option');
                option.value = level;
                option.textContent = level;
                levelSelect.appendChild(option);
            });

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

    // Event listeners for dynamic speaker setup
    numSpeakersInput.addEventListener('change', initializeSpeakers);
    initializeSpeakers();

    generateBtn.addEventListener('click', async () => {
        const topic = textInput.value.trim();
        const duration = parseInt(document.getElementById('podcast-duration').value);
        const country = document.getElementById('country').value.trim();
        const state = document.getElementById('state').value.trim();
        const city = document.getElementById('city').value.trim();

        const speakers = Array.from(speakersContainer.children).map(config => ({
            name: config.querySelector('.name-input').value.trim(),
            level: config.querySelector('select:nth-child(2)').value,
            voice: config.querySelector('select:nth-child(3)').value
        }));

        if (!topic || speakers.length < 2 || !country) {
            alert('Please provide a topic, at least 2 lawyers, and jurisdiction details.');
            return;
        }

        progressDiv.textContent = 'Generating podcast...';
        conversationDiv.innerHTML = '';
        audioContainer.innerHTML = '';

        try {
            let previousLines = '';
            let totalWords = duration * 130; // Approximate words per minute
            let totalLines = Math.ceil(totalWords / averageWordsPerLine);
            let totalChunks = Math.ceil(totalLines / linesPerChunk);

            audioBuffers = []; // Reset audio buffers

            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const isFirstChunk = chunkIndex === 0;
                const isLastChunk = chunkIndex === totalChunks - 1;

                progressDiv.textContent = `Generating chunk ${chunkIndex + 1} of ${totalChunks}...`;

                const response = await fetch('/api/generate-conversation-chunk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic,
                        speakers,
                        previousLines,
                        linesPerChunk,
                        country,
                        state,
                        city,
                        isFirstChunk,
                        isLastChunk
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('API Error:', errorText);
                    throw new Error('Failed to generate conversation chunk.');
                }

                const data = await response.json();
                const chunkText = data.conversationText;

                const lines = chunkText.split('\n');
                lines.forEach(line => {
                    const lineDiv = document.createElement('div');
                    lineDiv.textContent = line;
                    conversationDiv.appendChild(lineDiv);
                });

                previousLines = lines.slice(-3).join('\n'); // Keep the last 3 lines as context

                const chunkAudioBuffer = await generateAudio(chunkText, speakers);
                audioBuffers.push(chunkAudioBuffer);
            }

            combinedAudioBuffer = await combineAudioBuffers(audioBuffers);
            createAudioControls(combinedAudioBuffer);
            progressDiv.textContent = 'Podcast generation complete!';
        } catch (error) {
            console.error('Error generating podcast:', error);
            alert('Failed to generate podcast. Check logs for details.');
        }
    });

    async function generateAudio(text, speakers) {
        const response = await fetch('/api/generate-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, speakers })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Audio API Error:', errorText);
            throw new Error('Failed to generate audio.');
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        return await audioContext.decodeAudioData(arrayBuffer);
    }

    async function combineAudioBuffers(buffers) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const totalDuration = buffers.reduce((sum, buffer) => sum + buffer.duration, 0);
        const combinedBuffer = audioContext.createBuffer(
            buffers[0].numberOfChannels,
            totalDuration * buffers[0].sampleRate,
            buffers[0].sampleRate
        );

        let offset = 0;
        buffers.forEach(buffer => {
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                const combinedData = combinedBuffer.getChannelData(channel);
                const bufferData = buffer.getChannelData(channel);
                combinedData.set(bufferData, offset);
            }
            offset += buffer.length;
        });

        return combinedBuffer;
    }

    function createAudioControls(buffer) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createBufferSource();
        source.buffer = buffer;

        const playButton = document.createElement('button');
        playButton.textContent = 'Play Podcast';
        playButton.onclick = () => {
            source.connect(audioContext.destination);
            source.start(0);
        };

        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download Podcast';
        downloadButton.onclick = () => {
            const wavData = audioBufferToWav(buffer);
            const blob = new Blob([new DataView(wavData)], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'podcast.wav';
            link.click();
        };

        audioContainer.appendChild(playButton);
        audioContainer.appendChild(downloadButton);
    }

    function audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        const wav = new ArrayBuffer(44 + length * 2);
        const view = new DataView(wav);

        view.setUint32(0, 0x46464952, false); // "RIFF"
        view.setUint32(4, 36 + length * 2, true);
        view.setUint32(8, 0x45564157, false); // "WAVE"
        view.setUint32(12, 0x20746d66, false); // "fmt "
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2 * numChannels, true);
        view.setUint16(32, numChannels * 2, true);
        view.setUint16(34, 16, true);
        view.setUint32(36, 0x61746164, false); // "data"
        view.setUint32(40, length * 2, true);

        for (let i = 0; i < length; i++) {
            const sample = Math.max(-1, Math.min(1, buffer.getChannelData(0)[i]));
            view.setInt16(44 + i * 2, sample * (sample < 0 ? 0x8000 : 0x7FFF), true);
        }

        return wav;
    }
});
