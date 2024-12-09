document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const textInput = document.getElementById('text-input');
    const progressDiv = document.getElementById('progress');
    const conversationDiv = document.getElementById('conversation');
    const numSpeakersInput = document.getElementById('num-speakers');
    const speakersContainer = document.getElementById('speakers-container');

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
        speakersContainer.innerHTML = ''; // Clear previous configurations

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

    numSpeakersInput.addEventListener('change', initializeSpeakers);
    initializeSpeakers(); // Initial setup on page load

    generateBtn.addEventListener('click', async () => {
        const topic = textInput.value.trim();
        const duration = parseInt(document.getElementById('podcast-duration').value);
        const country = document.getElementById('country').value.trim();
        const state = document.getElementById('state').value.trim();
        const city = document.getElementById('city').value.trim();

        const speakers = Array.from(speakersContainer.children).map(config => {
            const name = config.querySelector('.name-input').value.trim();
            const level = config.querySelector('select:nth-child(2)').value;
            const voice = config.querySelector('select:nth-child(3)').value;
            return { name, level, voice };
        });

        if (!topic || speakers.length < 2 || !country) {
            alert('Please provide a topic, at least 2 lawyers, and jurisdiction details.');
            return;
        }

        console.log('Request to backend:', { topic, speakers, country, state, city, duration });

        progressDiv.textContent = 'Generating podcast...';

        try {
            const response = await fetch('/api/generate-conversation-chunk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, speakers, country, state, city, duration })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Response Error:', errorText);
                alert('Failed to generate podcast. Check the logs for details.');
                return;
            }

            const data = await response.json();
            console.log('Backend Response:', data);

            const conversation = data.conversationText;

            conversationDiv.innerHTML = '';
            const lines = conversation.split('\n');
            lines.forEach(line => {
                const lineDiv = document.createElement('div');
                lineDiv.textContent = line;
                conversationDiv.appendChild(lineDiv);
            });

            alert('Podcast generated successfully.');
        } catch (error) {
            console.error('Error in API call:', error);
            alert('Failed to generate podcast due to an unexpected error.');
        }
    });
});
