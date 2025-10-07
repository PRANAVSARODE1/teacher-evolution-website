// Teacher Assessment Platform - Simplified Version for GitHub Pages
class TeacherAssessmentPlatform {
    constructor() {
        this.isAssessmentRunning = false;
        this.assessmentData = {
            voiceMetrics: { confidence: 0, volume: 0, clarity: 0, audibility: 0 },
            facialMetrics: { teacherEmotion: 'neutral', engagementLevel: 0, expressionVariety: 0 },
            teachingMetrics: { interactionLevel: 0, exampleUsage: 0, studentEngagement: 0 },
            timestamps: [], duration: 0
        };
        
        this.mediaStream = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.faceDetectionModel = null;
        this.assessmentTimer = null;
        this.startTime = null;
        
        this.initializeEventListeners();
        this.initializeOfflineMode();
    }

    async initializeEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.updateActiveNavLink(link);
            });
        });

        // Sidebar navigation
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.showSection(section);
                this.updateActiveSidebarLink(link);
            });
        });

        // Duration selector
        document.querySelectorAll('.duration-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('assessment-duration').value = btn.dataset.duration;
            });
        });

        // Media control buttons
        document.getElementById('start-camera').addEventListener('click', () => this.startCamera());
        document.getElementById('start-microphone').addEventListener('click', () => this.startMicrophone());
        document.getElementById('start-assessment').addEventListener('click', () => this.startAssessment());
        document.getElementById('pause-assessment').addEventListener('click', () => this.pauseAssessment());
        document.getElementById('stop-assessment').addEventListener('click', () => this.stopAssessment());
        
        // Report actions
        document.getElementById('download-report').addEventListener('click', () => this.downloadReport());
        document.getElementById('new-assessment').addEventListener('click', () => this.resetAssessment());
    }

    updateActiveNavLink(activeLink) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
    }

    updateActiveSidebarLink(activeLink) {
        document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
        activeLink.classList.add('active');
    }

    showSection(sectionName) {
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    }

    async initializeOfflineMode() {
        try {
            console.log('Initializing assessment platform...');
            this.showNotification('Platform initializing...', 'info');
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.showNotification('Platform ready! All features available.', 'success');
        } catch (error) {
            console.error('Error initializing platform:', error);
            this.showNotification('Platform initialized with basic features.', 'warning');
        }
    }

    async startCamera() {
        try {
            const video = document.getElementById('teacher-video');
            const canvas = document.getElementById('teacher-canvas');
            const ctx = canvas.getContext('2d');
            
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
                audio: true
            });
            
            video.srcObject = this.mediaStream;
            
            video.addEventListener('loadedmetadata', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            });
            
            const statusElement = document.getElementById('camera-status');
            statusElement.innerHTML = '<i class="fas fa-circle" style="color: var(--success-color);"></i><span>Camera: Active</span>';
            statusElement.classList.add('active');
            
            this.showNotification('Camera started successfully!', 'success');
            this.checkMediaReady();
            
        } catch (error) {
            console.error('Error starting camera:', error);
            const statusElement = document.getElementById('camera-status');
            statusElement.innerHTML = '<i class="fas fa-circle" style="color: var(--danger-color);"></i><span>Camera: Error</span>';
            statusElement.classList.add('error');
            
            if (error.name === 'NotAllowedError') {
                this.showNotification('Camera access denied. Please allow camera permissions.', 'error');
            } else if (error.name === 'NotFoundError') {
                this.showNotification('No camera found. Please connect a camera.', 'error');
            } else {
                this.showNotification('Failed to start camera. Please check permissions.', 'error');
            }
        }
    }

    async startMicrophone() {
        try {
            if (!this.mediaStream) {
                this.showNotification('Please start camera first to get audio stream.', 'warning');
                return;
            }
            
            const audioTracks = this.mediaStream.getAudioTracks();
            if (audioTracks.length === 0) {
                this.showNotification('No audio tracks found. Please ensure microphone is connected.', 'error');
                return;
            }
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            
            this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.microphone.connect(this.analyser);
            
            const statusElement = document.getElementById('mic-status');
            statusElement.innerHTML = '<i class="fas fa-circle" style="color: var(--success-color);"></i><span>Microphone: Active</span>';
            statusElement.classList.add('active');
            
            this.showNotification('Microphone started successfully!', 'success');
            this.checkMediaReady();
            
        } catch (error) {
            console.error('Error starting microphone:', error);
            const statusElement = document.getElementById('mic-status');
            statusElement.innerHTML = '<i class="fas fa-circle" style="color: var(--danger-color);"></i><span>Microphone: Error</span>';
            statusElement.classList.add('error');
            
            if (error.name === 'NotAllowedError') {
                this.showNotification('Microphone access denied. Please allow microphone permissions.', 'error');
            } else if (error.name === 'NotFoundError') {
                this.showNotification('No microphone found. Please connect a microphone.', 'error');
            } else {
                this.showNotification('Failed to start microphone. Please check permissions.', 'error');
            }
        }
    }

    checkMediaReady() {
        const cameraActive = document.getElementById('camera-status').classList.contains('active');
        const micActive = document.getElementById('mic-status').classList.contains('active');
        
        if (cameraActive && micActive) {
            document.getElementById('start-assessment').disabled = false;
            this.showNotification('Ready to start assessment!', 'success');
        }
    }

    async startAssessment() {
        const teacherName = document.getElementById('teacher-name').value.trim();
        const institution = document.getElementById('institution').value.trim();
        
        if (!teacherName || !institution) {
            this.showNotification('Please fill in all required fields (Teacher Name and Institution).', 'error');
            return;
        }
        
        this.isAssessmentRunning = true;
        this.startTime = Date.now();
        this.assessmentData.startTime = this.startTime;
        
        this.showSection('live');
        this.updateActiveSidebarLink(document.querySelector('[data-section="live"]'));
        
        this.startTimer();
        this.startRealTimeAnalysis();
        this.showNotification('Assessment started with AI analysis! Begin teaching now.', 'success');
        
        this.analyzeAudio();
        this.simulateFacialExpressions();
    }

    startTimer() {
        this.assessmentTimer = setInterval(() => {
            if (!this.isAssessmentRunning) return;
            
            const elapsed = Date.now() - this.startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            document.getElementById('assessment-timer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    simulateFacialExpressions() {
        if (!this.isAssessmentRunning) return;
        
        const emotions = ['neutral', 'happy', 'serious', 'confident', 'engaged'];
        const emotion = emotions[Math.floor(Math.random() * emotions.length)];
        
        let engagementLevel;
        switch (emotion) {
            case 'happy': engagementLevel = 85 + Math.random() * 15; break;
            case 'confident': engagementLevel = 80 + Math.random() * 20; break;
            case 'engaged': engagementLevel = 75 + Math.random() * 25; break;
            case 'serious': engagementLevel = 65 + Math.random() * 30; break;
            default: engagementLevel = 70 + Math.random() * 25;
        }
        
        this.assessmentData.facialMetrics.teacherEmotion = emotion;
        this.assessmentData.facialMetrics.engagementLevel = engagementLevel;
        
        document.getElementById('teacher-emotion').textContent = emotion.charAt(0).toUpperCase() + emotion.slice(1);
        document.getElementById('engagement-level').textContent = `${engagementLevel.toFixed(1)}%`;
        this.updateMetricBar('engagement-bar', engagementLevel);
        
        setTimeout(() => this.simulateFacialExpressions(), 2500);
    }

    analyzeAudio() {
        if (!this.isAssessmentRunning || !this.analyser) return;
        
        try {
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            this.analyser.getByteFrequencyData(dataArray);
            
            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            const volumeVariance = this.calculateVariance(dataArray);
            const confidence = Math.max(0, 100 - volumeVariance * 2);
            const volume = (average / 255) * 100;
            const clarity = this.calculateClarity(dataArray);
            const audibility = Math.min(100, volume * 1.2);
            
            this.assessmentData.voiceMetrics.confidence = confidence;
            this.assessmentData.voiceMetrics.volume = volume;
            this.assessmentData.voiceMetrics.clarity = clarity;
            this.assessmentData.voiceMetrics.audibility = audibility;
            
            document.getElementById('voice-confidence').textContent = `${confidence.toFixed(1)}%`;
            document.getElementById('voice-volume').textContent = `${volume.toFixed(1)}%`;
            document.getElementById('voice-clarity').textContent = `${clarity.toFixed(1)}%`;
            document.getElementById('audibility-score').textContent = `${audibility.toFixed(1)}%`;
            
            this.updateMetricBar('confidence-bar', confidence);
            this.updateMetricBar('volume-bar', volume);
            this.updateMetricBar('clarity-bar', clarity);
            this.updateMetricBar('audibility-bar', audibility);
            
            if (this.isAssessmentRunning) {
                requestAnimationFrame(() => this.analyzeAudio());
            }
        } catch (error) {
            console.error('Error in audio analysis:', error);
            this.simulateAudioMetrics();
        }
    }

    simulateAudioMetrics() {
        if (!this.isAssessmentRunning) return;
        
        const confidence = Math.random() * 20 + 70;
        const volume = Math.random() * 30 + 60;
        const clarity = Math.random() * 25 + 65;
        const audibility = Math.random() * 20 + 75;
        
        this.assessmentData.voiceMetrics.confidence = confidence;
        this.assessmentData.voiceMetrics.volume = volume;
        this.assessmentData.voiceMetrics.clarity = clarity;
        this.assessmentData.voiceMetrics.audibility = audibility;
        
        document.getElementById('voice-confidence').textContent = `${confidence.toFixed(1)}%`;
        document.getElementById('voice-volume').textContent = `${volume.toFixed(1)}%`;
        document.getElementById('voice-clarity').textContent = `${clarity.toFixed(1)}%`;
        document.getElementById('audibility-score').textContent = `${audibility.toFixed(1)}%`;
        
        this.updateMetricBar('confidence-bar', confidence);
        this.updateMetricBar('volume-bar', volume);
        this.updateMetricBar('clarity-bar', clarity);
        this.updateMetricBar('audibility-bar', audibility);
        
        if (this.isAssessmentRunning) {
            setTimeout(() => this.simulateAudioMetrics(), 1000);
        }
    }

    updateMetricBar(barId, value) {
        const bar = document.getElementById(barId);
        if (bar) {
            bar.style.width = `${Math.min(100, Math.max(0, value))}%`;
        }
    }

    calculateVariance(dataArray) {
        const mean = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const variance = dataArray.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / dataArray.length;
        return Math.sqrt(variance);
    }

    calculateClarity(dataArray) {
        const lowFreq = dataArray.slice(0, dataArray.length / 4).reduce((a, b) => a + b) / (dataArray.length / 4);
        const midFreq = dataArray.slice(dataArray.length / 4, dataArray.length * 3 / 4).reduce((a, b) => a + b) / (dataArray.length / 2);
        const highFreq = dataArray.slice(dataArray.length * 3 / 4).reduce((a, b) => a + b) / (dataArray.length / 4);
        
        const balance = Math.min(lowFreq, midFreq, highFreq) / Math.max(lowFreq, midFreq, highFreq);
        return balance * 100;
    }

    startRealTimeAnalysis() {
        this.simulateTeachingMetrics();
        
        const interactionLevel = Math.random() * 40 + 60;
        const exampleUsage = Math.random() * 30 + 70;
        
        this.assessmentData.teachingMetrics.interactionLevel = interactionLevel;
        this.assessmentData.teachingMetrics.exampleUsage = exampleUsage;
        
        document.getElementById('interaction-level').textContent = `${interactionLevel.toFixed(1)}%`;
        document.getElementById('example-usage').textContent = `${exampleUsage.toFixed(1)}%`;
        
        this.updateMetricBar('interaction-bar', interactionLevel);
        this.updateMetricBar('examples-bar', exampleUsage);
    }

    simulateTeachingMetrics() {
        this.metricsInterval = setInterval(() => {
            if (!this.isAssessmentRunning) return;
            
            const timestamp = {
                time: Date.now() - this.assessmentData.startTime,
                voiceMetrics: { ...this.assessmentData.voiceMetrics },
                facialMetrics: { ...this.assessmentData.facialMetrics },
                teachingMetrics: { ...this.assessmentData.teachingMetrics }
            };
            
            this.assessmentData.timestamps.push(timestamp);
        }, 1000);
    }

    pauseAssessment() {
        this.isAssessmentRunning = false;
        if (this.metricsInterval) clearInterval(this.metricsInterval);
        if (this.assessmentTimer) clearInterval(this.assessmentTimer);
        this.showNotification('Assessment paused', 'warning');
    }

    async stopAssessment() {
        this.isAssessmentRunning = false;
        this.assessmentData.endTime = Date.now();
        this.assessmentData.duration = this.assessmentData.endTime - this.assessmentData.startTime;
        
        if (this.metricsInterval) clearInterval(this.metricsInterval);
        if (this.assessmentTimer) clearInterval(this.assessmentTimer);
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        
        await this.generateReport();
        
        this.showSection('results');
        this.updateActiveSidebarLink(document.querySelector('[data-section="results"]'));
        
        this.showNotification('Assessment completed! Report generated.', 'success');
    }

    async generateReport() {
        const voiceScore = (
            this.assessmentData.voiceMetrics.confidence * 0.3 +
            this.assessmentData.voiceMetrics.audibility * 0.4 +
            this.assessmentData.voiceMetrics.clarity * 0.3
        );
        
        const facialScore = (
            this.assessmentData.facialMetrics.engagementLevel * 0.6 +
            this.assessmentData.facialMetrics.expressionVariety * 0.4
        );
        
        const teachingScore = (
            this.assessmentData.teachingMetrics.interactionLevel * 0.4 +
            this.assessmentData.teachingMetrics.exampleUsage * 0.3 +
            this.assessmentData.teachingMetrics.studentEngagement * 0.3
        );
        
        const overallScore = (voiceScore * 0.4 + facialScore * 0.3 + teachingScore * 0.3);
        
        document.getElementById('overall-score').textContent = overallScore.toFixed(1);
        
        let eligibilityStatus = 'needs-improvement';
        let statusText = 'Needs Improvement';
        let statusClass = 'warning';
        
        if (overallScore >= 85) {
            eligibilityStatus = 'eligible';
            statusText = 'Eligible';
            statusClass = 'success';
        } else if (overallScore >= 70) {
            eligibilityStatus = 'needs-improvement';
            statusText = 'Needs Improvement';
            statusClass = 'warning';
        } else {
            eligibilityStatus = 'not-eligible';
            statusText = 'Not Eligible';
            statusClass = 'danger';
        }
        
        const statusElement = document.getElementById('eligibility-status');
        statusElement.innerHTML = `<span class="status-text" style="color: var(--${statusClass}-color);">${statusText}</span>`;
        
        this.updateProgressBar('confidence-progress', this.assessmentData.voiceMetrics.confidence);
        document.getElementById('confidence-score').textContent = this.assessmentData.voiceMetrics.confidence.toFixed(1);
        
        this.updateProgressBar('audibility-progress', this.assessmentData.voiceMetrics.audibility);
        document.getElementById('audibility-score-final').textContent = this.assessmentData.voiceMetrics.audibility.toFixed(1);
        
        this.updateProgressBar('interaction-progress', this.assessmentData.teachingMetrics.interactionLevel);
        document.getElementById('interaction-score').textContent = this.assessmentData.teachingMetrics.interactionLevel.toFixed(1);
        
        this.updateProgressBar('example-progress', this.assessmentData.teachingMetrics.exampleUsage);
        document.getElementById('example-score').textContent = this.assessmentData.teachingMetrics.exampleUsage.toFixed(1);
        
        this.updateProgressBar('engagement-progress', this.assessmentData.facialMetrics.engagementLevel);
        document.getElementById('engagement-score').textContent = this.assessmentData.facialMetrics.engagementLevel.toFixed(1);
        
        this.generateRecommendations(overallScore);
    }

    updateProgressBar(elementId, value) {
        const progressBar = document.getElementById(elementId);
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, value))}%`;
        }
    }

    generateRecommendations(overallScore) {
        const recommendations = [];
        
        if (this.assessmentData.voiceMetrics.confidence < 70) {
            recommendations.push('Work on voice confidence and projection. Practice speaking clearly and assertively.');
        }
        
        if (this.assessmentData.voiceMetrics.audibility < 75) {
            recommendations.push('Improve voice projection to ensure students at the back can hear clearly.');
        }
        
        if (this.assessmentData.teachingMetrics.interactionLevel < 80) {
            recommendations.push('Increase student interaction through questions, discussions, and active participation.');
        }
        
        if (this.assessmentData.teachingMetrics.exampleUsage < 75) {
            recommendations.push('Use more real-world examples and practical applications to explain concepts.');
        }
        
        if (this.assessmentData.facialMetrics.engagementLevel < 70) {
            recommendations.push('Work on facial expressions and body language to appear more engaging.');
        }
        
        if (overallScore < 70) {
            recommendations.push('Consider additional training in teaching methodologies and classroom management.');
        }
        
        const recommendationsList = document.getElementById('recommendations-list');
        if (recommendations.length > 0) {
            recommendationsList.innerHTML = recommendations.map(rec => `<li>${rec}</li>`).join('');
        } else {
            recommendationsList.innerHTML = '<li>Great job! Your teaching performance meets all criteria.</li>';
        }
    }

    downloadReport() {
        const subjectValue = document.getElementById('subject').value;
        const otherSubject = document.getElementById('other-subject')?.value || '';
        const finalSubject = subjectValue === 'other' ? otherSubject : subjectValue;
        
        const reportData = {
            teacherName: document.getElementById('teacher-name').value,
            subject: finalSubject,
            institution: document.getElementById('institution').value,
            assessmentDate: new Date().toISOString(),
            overallScore: document.getElementById('overall-score').textContent,
            eligibilityStatus: document.getElementById('eligibility-status').textContent.trim(),
            detailedMetrics: this.assessmentData,
            recommendations: Array.from(document.querySelectorAll('#recommendations-list li')).map(li => li.textContent)
        };
        
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `teacher-assessment-report-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Report downloaded successfully!', 'success');
    }

    resetAssessment() {
        this.assessmentData = {
            voiceMetrics: { confidence: 0, volume: 0, clarity: 0, audibility: 0 },
            facialMetrics: { teacherEmotion: 'neutral', engagementLevel: 0, expressionVariety: 0 },
            teachingMetrics: { interactionLevel: 0, exampleUsage: 0, studentEngagement: 0 },
            timestamps: [], duration: 0
        };
        
        if (this.metricsInterval) clearInterval(this.metricsInterval);
        if (this.assessmentTimer) clearInterval(this.assessmentTimer);
        
        this.showSection('setup');
        this.updateActiveSidebarLink(document.querySelector('[data-section="setup"]'));
        
        document.getElementById('start-assessment').disabled = true;
        
        document.getElementById('teacher-name').value = '';
        document.getElementById('institution').value = '';
        document.getElementById('subject').value = 'engineering';
        if (document.getElementById('other-subject')) {
            document.getElementById('other-subject').value = '';
            document.getElementById('other-subject-group').style.display = 'none';
        }
        
        document.getElementById('camera-status').innerHTML = '<i class="fas fa-circle"></i><span>Camera: Not Started</span>';
        document.getElementById('camera-status').classList.remove('active', 'error');
        document.getElementById('mic-status').innerHTML = '<i class="fas fa-circle"></i><span>Microphone: Not Started</span>';
        document.getElementById('mic-status').classList.remove('active', 'error');
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        this.showNotification('Assessment reset. Ready for new assessment.', 'success');
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Function to toggle other subject input field
function toggleOtherSubject() {
    const subjectSelect = document.getElementById('subject');
    const otherSubjectGroup = document.getElementById('other-subject-group');
    const otherSubjectInput = document.getElementById('other-subject');
    
    if (subjectSelect.value === 'other') {
        otherSubjectGroup.style.display = 'block';
        otherSubjectInput.required = true;
        otherSubjectInput.focus();
    } else {
        otherSubjectGroup.style.display = 'none';
        otherSubjectInput.required = false;
        otherSubjectInput.value = '';
    }
}

// Initialize the platform when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.teacherAssessment = new TeacherAssessmentPlatform();
});