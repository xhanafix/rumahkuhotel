class ProjectTracker {
    constructor() {
        this.API_URL = 'https://openrouter.ai/api/v1/chat/completions';
        this.initializeElements();
        this.checkApiKey();
        this.loadSavedSchedule();
        this.addEventListeners();
    }

    initializeElements() {
        this.startDateInput = document.getElementById('start-date');
        this.generateButton = document.getElementById('generate-schedule');
        this.scheduleContainer = document.getElementById('schedule-container');
        this.loadingSpinner = document.getElementById('loading-spinner');
        this.apiKeySection = document.getElementById('api-key-section');
        this.apiKeyInput = document.getElementById('api-key');
        this.saveApiKeyButton = document.getElementById('save-api-key');
        this.progressContainer = document.getElementById('progress-container');
        this.progressBar = document.getElementById('progress-bar');
        this.progressText = document.getElementById('progress-text');
    }

    addEventListeners() {
        this.generateButton.addEventListener('click', () => this.generateSchedule());
        this.saveApiKeyButton.addEventListener('click', () => this.saveApiKey());
    }

    checkApiKey() {
        this.API_KEY = localStorage.getItem('openrouter_api_key');
        if (!this.API_KEY) {
            this.apiKeySection.style.display = 'block';
            this.generateButton.disabled = true;
        } else {
            this.apiKeySection.style.display = 'none';
            this.generateButton.disabled = false;
        }
    }

    saveApiKey() {
        const apiKey = this.apiKeyInput.value.trim();
        if (!apiKey) {
            this.showError('Please enter a valid API key');
            return;
        }

        localStorage.setItem('openrouter_api_key', apiKey);
        this.API_KEY = apiKey;
        this.apiKeySection.style.display = 'none';
        this.generateButton.disabled = false;
        this.showSuccess('API key saved successfully');
    }

    async fetchScheduleFromAI(startDate) {
        const prompt = `Create a detailed construction schedule for a 300 sq ft capsule house in Malaysia starting on ${startDate}. 
        Consider Malaysian context:
        - Working hours: Monday to Saturday, 8am to 5pm
        - Weather: Tropical climate with monsoon seasons
        - Local building regulations and practices
        - Local construction materials and methods
        - Malaysian public holidays

        Return a valid JSON object with this EXACT structure:
        {
            "phases": [
                {
                    "name": "Phase Name",
                    "duration": number,
                    "startDate": "YYYY-MM-DD",
                    "endDate": "YYYY-MM-DD",
                    "description": "Detailed phase description",
                    "workInvolved": ["List of specific work tasks"],
                    "materials": [
                        {
                            "name": "Material name",
                            "quantity": "Amount needed",
                            "specifications": "Material specs and Malaysian standards"
                        }
                    ],
                    "equipment": ["Required tools"],
                    "laborNeeded": ["Required workers"],
                    "qualityChecks": ["Quality control points"],
                    "weatherConsiderations": ["Weather-related precautions"],
                    "safetyMeasures": ["Safety requirements per Malaysian regulations"]
                }
            ]
        }

        Include these phases with Malaysian construction considerations:

        1. Foundation:
           - Site clearing and soil preparation (consider monsoon drainage)
           - Piling if needed (based on Malaysian soil conditions)
           - Concrete work (adjust for humid climate)
           - Waterproofing (tropical-grade materials)

        2. Structure:
           - Steel/aluminum frame (corrosion-resistant for tropical climate)
           - Wall panels (heat-resistant materials)
           - Roof (designed for heavy rainfall)
           - Windows (hurricane-rated)
           - Weather protection (consider monsoon seasons)

        3. Utilities:
           - Electrical (follow Malaysian standards)
           - Plumbing (tropical considerations)
           - HVAC (sized for tropical climate)
           - TNB connection requirements
           - Local authority approvals

        4. Interior:
           - Moisture-resistant materials
           - Tropical-grade finishes
           - Heat-resistant fixtures
           - Local authority compliance
           - Built-in ventilation features

        5. Final inspection:
           - Local authority approvals
           - CCC requirements
           - Malaysian building standards compliance
           - Final documentation

        For each phase include:
        - Work steps adapted for Malaysian climate
        - Materials available in Malaysian market
        - Local equipment and tools
        - Labor requirements (skilled and unskilled)
        - Quality control per Malaysian standards
        - Weather contingency plans
        - Safety measures per DOSH requirements

        Consider scheduling around:
        - Typical monsoon seasons (Nov-Mar & May-Sep)
        - Malaysian public holidays
        - Friday prayer times
        - Ramadan period adjustments
        - Local working hours

        IMPORTANT: Ensure the response is a properly formatted JSON object ONLY.`;

        try {
            console.log('Sending request to API...');
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Capsule House Project Tracker',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'google/learnlm-1.5-pro-experimental:free',
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    max_tokens: 2000,
                    temperature: 0.3 // Lower temperature for more consistent output
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const responseData = await response.json();
            console.log('Raw API Response:', responseData);

            if (!responseData.choices?.[0]?.message?.content) {
                throw new Error('Invalid API response structure');
            }

            const content = responseData.choices[0].message.content.trim();
            console.log('Content to parse:', content);

            // Try to extract JSON from the content
            let jsonStr = content;
            if (content.includes('{')) {
                const startIdx = content.indexOf('{');
                const endIdx = content.lastIndexOf('}') + 1;
                jsonStr = content.slice(startIdx, endIdx);
            }

            try {
                const schedule = JSON.parse(jsonStr);
                console.log('Parsed schedule:', schedule);
                
                if (!schedule.phases?.length) {
                    throw new Error('No phases found in schedule');
                }

                return schedule;
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError);
                console.error('Failed to parse:', jsonStr);
                throw new Error('Failed to parse API response as JSON');
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            throw new Error(`Failed to generate schedule: ${error.message}`);
        }
    }

    parseAIResponse(data) {
        try {
            if (!data.choices?.[0]?.message?.content) {
                throw new Error('Invalid API response structure');
            }

            const content = data.choices[0].message.content.trim();
            let schedule;

            try {
                // First try direct parsing
                schedule = JSON.parse(content);
            } catch (e) {
                // If direct parsing fails, try to extract JSON
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No valid JSON found in response');
                }
                schedule = JSON.parse(jsonMatch[0]);
            }

            if (!schedule.phases || !Array.isArray(schedule.phases)) {
                throw new Error('Invalid schedule format: missing phases array');
            }

            // Validate and process each phase
            schedule.phases = schedule.phases.map((phase, index) => {
                if (!phase.name || !phase.duration) {
                    throw new Error(`Missing required fields in phase ${index + 1}`);
                }

                return {
                    name: phase.name,
                    duration: parseInt(phase.duration),
                    startDate: phase.startDate || new Date().toISOString().split('T')[0],
                    endDate: phase.endDate || new Date(new Date().getTime() + phase.duration * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    description: phase.description || '',
                    workInvolved: Array.isArray(phase.workInvolved) ? phase.workInvolved : [],
                    materials: Array.isArray(phase.materials) ? phase.materials : [],
                    equipment: Array.isArray(phase.equipment) ? phase.equipment : [],
                    laborNeeded: Array.isArray(phase.laborNeeded) ? phase.laborNeeded : [],
                    qualityChecks: Array.isArray(phase.qualityChecks) ? phase.qualityChecks : [],
                    weatherConsiderations: Array.isArray(phase.weatherConsiderations) ? phase.weatherConsiderations : [],
                    safetyMeasures: Array.isArray(phase.safetyMeasures) ? phase.safetyMeasures : []
                };
            });

            return schedule;
        } catch (error) {
            console.error('Parse Error:', error);
            throw new Error(`Failed to parse schedule data: ${error.message}`);
        }
    }

    displaySchedule(schedule) {
        try {
            this.scheduleContainer.innerHTML = '';
            
            if (!schedule.phases || schedule.phases.length === 0) {
                this.scheduleContainer.innerHTML = '<p class="error-message">No schedule phases found</p>';
                return;
            }
            
            schedule.phases.forEach(phase => {
                const phaseElement = document.createElement('div');
                phaseElement.className = 'schedule-item';

                const workInvolvedHtml = Array.isArray(phase.workInvolved) && phase.workInvolved.length > 0 ? `
                    <div class="work-involved">
                        <h4>Work Involved:</h4>
                        <ul>
                            ${phase.workInvolved.map(work => `
                                <li>${this.escapeHtml(work)}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : '';

                const materialsHtml = Array.isArray(phase.materials) && phase.materials.length > 0 ? `
                    <div class="materials-list">
                        <h4>Materials Required:</h4>
                        <div class="materials-grid">
                            ${phase.materials.map(material => `
                                <div class="material-item">
                                    <strong>${this.escapeHtml(material.name)}</strong>
                                    <p>Quantity: ${this.escapeHtml(material.quantity)}</p>
                                    <p>Specs: ${this.escapeHtml(material.specifications)}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : '';

                const equipmentHtml = Array.isArray(phase.equipment) && phase.equipment.length > 0 ? `
                    <div class="equipment-list">
                        <h4>Equipment Needed:</h4>
                        <ul>
                            ${phase.equipment.map(item => `
                                <li>${this.escapeHtml(item)}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : '';

                const laborHtml = Array.isArray(phase.laborNeeded) && phase.laborNeeded.length > 0 ? `
                    <div class="labor-list">
                        <h4>Labor Requirements:</h4>
                        <ul>
                            ${phase.laborNeeded.map(labor => `
                                <li>${this.escapeHtml(labor)}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : '';

                const qualityChecksHtml = Array.isArray(phase.qualityChecks) && phase.qualityChecks.length > 0 ? `
                    <div class="quality-checks">
                        <h4>Quality Control Points:</h4>
                        <ul>
                            ${phase.qualityChecks.map(check => `
                                <li>${this.escapeHtml(check)}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : '';

                const weatherHtml = Array.isArray(phase.weatherConsiderations) && phase.weatherConsiderations.length > 0 ? `
                    <div class="weather-considerations">
                        <h4>Weather Considerations:</h4>
                        <ul>
                            ${phase.weatherConsiderations.map(item => `
                                <li>${this.escapeHtml(item)}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : '';

                const safetyHtml = Array.isArray(phase.safetyMeasures) && phase.safetyMeasures.length > 0 ? `
                    <div class="safety-measures">
                        <h4>Safety Measures:</h4>
                        <ul>
                            ${phase.safetyMeasures.map(item => `
                                <li>${this.escapeHtml(item)}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : '';

                phaseElement.innerHTML = `
                    <div class="phase-header">
                        <h3>${this.escapeHtml(phase.name)}</h3>
                        <div class="phase-duration">
                            <span class="duration-badge">${phase.duration} days</span>
                        </div>
                    </div>
                    <div class="phase-dates">
                        <p>Start: ${this.formatDate(phase.startDate)}</p>
                        <p>End: ${this.formatDate(phase.endDate)}</p>
                    </div>
                    <div class="phase-description">
                        <p>${this.escapeHtml(phase.description || '')}</p>
                    </div>
                    ${workInvolvedHtml}
                    ${materialsHtml}
                    ${equipmentHtml}
                    ${laborHtml}
                    ${qualityChecksHtml}
                    ${weatherHtml}
                    ${safetyHtml}
                `;
                
                this.scheduleContainer.appendChild(phaseElement);
            });
        } catch (error) {
            console.error('Display Error:', error, error.stack);
            this.showError('Error displaying schedule: ' + error.message);
        }
    }

    saveSchedule(schedule) {
        localStorage.setItem('capsuleHouseSchedule', JSON.stringify({
            startDate: this.startDateInput.value,
            schedule: schedule
        }));
    }

    loadSavedSchedule() {
        const saved = localStorage.getItem('capsuleHouseSchedule');
        if (saved) {
            const { startDate, schedule } = JSON.parse(saved);
            this.startDateInput.value = startDate;
            this.displaySchedule(schedule);
        }
    }

    showLoading(show) {
        this.loadingSpinner.style.display = show ? 'block' : 'none';
        this.generateButton.disabled = show;
        
        if (!show) {
            this.progressContainer.style.display = 'none';
            this.updateProgress(0);
        }
    }

    showError(message) {
        console.error('Error:', message);
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        this.scheduleContainer.prepend(errorElement);
        
        alert(`Error: ${message}\nPlease check the console for more details.`);
    }

    showSuccess(message) {
        alert(message); // Consider replacing with a better UI notification
    }

    updateProgress(percent) {
        this.progressBar.style.width = `${percent}%`;
        this.progressText.textContent = `${percent}%`;
    }

    async generateSchedule() {
        const startDate = this.startDateInput.value;
        if (!startDate) {
            this.showError('Please select a start date');
            return;
        }

        this.showLoading(true);
        this.progressContainer.style.display = 'block';
        this.updateProgress(0);
        this.scheduleContainer.innerHTML = ''; // Clear previous content

        try {
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += 5;
                if (progress <= 90) {
                    this.updateProgress(progress);
                }
            }, 500);

            console.log('Generating schedule for start date:', startDate);
            const schedule = await this.fetchScheduleFromAI(startDate);
            
            clearInterval(progressInterval);
            this.updateProgress(100);
            
            console.log('Schedule generated successfully:', schedule);
            
            setTimeout(() => {
                this.displaySchedule(schedule);
                this.saveSchedule(schedule);
                this.progressContainer.style.display = 'none';
            }, 500);

        } catch (error) {
            console.error('Generation Error:', error);
            console.error('Error Stack:', error.stack);
            this.showError(`Failed to generate schedule: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString();
        } catch {
            return dateString;
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new ProjectTracker();
}); 